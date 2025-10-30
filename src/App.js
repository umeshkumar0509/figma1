import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import logoSvg from './images/logo.png';

function App() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [generatedHTML, setGeneratedHTML] = useState('');
  const [viewMode, setViewMode] = useState('preview'); 
  const [editableCode, setEditableCode] = useState('');
  const messagesEndRef = useRef(null);
  const jsonFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const iframeRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update iframe when HTML changes
  useEffect(() => {
    if (generatedHTML && iframeRef.current && viewMode === 'preview') {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(editableCode || generatedHTML);
      iframeDoc.close();
    }
  }, [generatedHTML, editableCode, viewMode]);

  // Generate random alt text for decorative icons
  const getRandomAltText = (type) => {
    const altTexts = {
      robot: ['AI assistant icon', 'Chat bot avatar', 'Artificial intelligence icon', 'Virtual assistant'],
      user: ['User avatar', 'Person icon', 'User profile', 'Account icon'],
      file: ['Document icon', 'File attachment', 'JSON file', 'Data file'],
      image: ['Image preview', 'Uploaded picture', 'Photo attachment', 'Visual content'],
      welcome: ['Welcome robot', 'Greeting bot', 'AI helper', 'Chat assistant']
    };
    
    const options = altTexts[type] || ['Icon'];
    return options[Math.floor(Math.random() * options.length)];
  };

  // Function to read JSON file
  const readJSONFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          console.log('JSON file read successfully:', json);
          resolve(json);
        } catch (error) {
          console.error('JSON parse error:', error);
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Function to read image file and convert to base64
  const readImageFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('Image file read successfully');
        const base64Data = e.target.result.split(',')[1];
        resolve({
          base64: base64Data,
          mimeType: file.type
        });
      };
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  };

  // Handle JSON file upload
  const handleJSONUpload = async (event) => {
    const files = Array.from(event.target.files);
    console.log('JSON files selected:', files.length);
    
    for (const file of files) {
      try {
        console.log('Reading JSON file:', file.name);
        const jsonData = await readJSONFile(file);
        
        const newFile = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: 'json',
          data: jsonData,
          preview: JSON.stringify(jsonData, null, 2).substring(0, 300) + '...',
          fullContent: JSON.stringify(jsonData, null, 2)
        };
        
        console.log('JSON file added:', newFile);
        setUploadedFiles(prev => [...prev, newFile]);
      } catch (error) {
        console.error('JSON file upload error:', error);
        alert(`Error reading JSON file ${file.name}: ${error.message}`);
      }
    }
    
    event.target.value = null;
  };

  // Handle image file upload
  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    console.log('Image files selected:', files.length);
    
    for (const file of files) {
      if (file.size > 4 * 1024 * 1024) {
        alert(`Image ${file.name} is too large. Please use images smaller than 4MB.`);
        continue;
      }
      
      try {
        console.log('Reading image file:', file.name);
        const imageData = await readImageFile(file);
        
        const newFile = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: 'image',
          data: imageData,
          preview: `data:${imageData.mimeType};base64,${imageData.base64}`
        };
        
        console.log('Image file added:', file.name);
        setUploadedFiles(prev => [...prev, newFile]);
      } catch (error) {
        console.error('Image upload error:', error);
        alert(`Error reading image ${file.name}: ${error.message}`);
      }
    }
    
    event.target.value = null;
  };

  // Remove uploaded file
  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Analyze image with Gemini Vision API
  const analyzeImageWithVision = async (imageData, userPrompt) => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    console.log('Analyzing image with Gemini Vision API...');
    
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: userPrompt || 'Analyze this image in detail and describe what you see.'
                },
                {
                  inline_data: {
                    mime_type: imageData.mimeType,
                    data: imageData.base64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Image analysis successful');
      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Image analysis error:', error.response?.data || error);
      throw error;
    }
  };

  const callGeminiAPI = async (userPrompt, filesContext = []) => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('API Key not found');
      return 'Error: API key not configured. Please add your Gemini API key to the .env file as REACT_APP_GEMINI_API_KEY.';
    }
  
    const cleanPrompt = userPrompt.trim();
    console.log('Processing request with prompt:', cleanPrompt);
    console.log('Files to process:', filesContext.length);
    
    if (!cleanPrompt && filesContext.length === 0) {
      return 'Please enter a valid message or upload a file.';
    }

    try {
      const jsonFiles = filesContext.filter(f => f.type === 'json');
      const imageFiles = filesContext.filter(f => f.type === 'image');
      
      console.log('JSON files:', jsonFiles.length);
      console.log('Image files:', imageFiles.length);

      let imageDescriptions = [];
      if (imageFiles.length > 0) {
        console.log('Starting detailed image analysis...');
        for (const imageFile of imageFiles) {
          try {
            const detailedPrompt = `Analyze this image in extreme detail for HTML/CSS recreation. Provide:
1. EXACT LAYOUT: Describe the precise layout structure (header, sections, columns, grid)
2. COLORS: List ALL colors used with EXACT hex codes:
   - Background colors (page, sections, cards, headers)
   - Text colors (headings, body text, labels, links)
   - Border colors (dividers, cards, buttons, inputs)
   - Button colors (background, text, hover states)
   - Accent colors (badges, highlights, icons)
3. TYPOGRAPHY: Font families, sizes, weights, styles, text alignment, line heights, letter spacing
4. SPACING: Exact margins, padding, gaps between elements (in pixels or rem)
5. COMPONENTS: Every UI element with their styling:
   - Buttons (size, padding, border-radius, shadows)
   - Cards (backgrounds, borders, shadows, spacing)
   - Forms (input styles, labels, focus states)
   - Tables (borders, cell padding, header styles)
   - Images (sizes, borders, shadows)
   - Icons and badges
6. DIMENSIONS: Exact widths, heights, sizes of all elements
7. POSITIONING: Layout method (flexbox, grid, positioning)
8. VISUAL EFFECTS: 
   - Box shadows (spread, blur, color, opacity)
   - Border radius values
   - Gradients (direction, colors, stops)
   - Hover/focus effects
   - Transitions and animations
9. EXACT CONTENT: All visible text, headings, labels, data, numbers, icons
10. STRUCTURE: Complete hierarchy from top to bottom
11. BORDERS: Style, width, and color for all bordered elements

Extract EXACT color codes from the design. Be extremely precise with all styling details.`;

            const analysis = await analyzeImageWithVision(imageFile.data, detailedPrompt);
            imageDescriptions.push({
              fileName: imageFile.name,
              description: analysis
            });
            console.log(`Image ${imageFile.name} analyzed in detail`);
          } catch (imgError) {
            console.error(`Error analyzing ${imageFile.name}:`, imgError);
            imageDescriptions.push({
              fileName: imageFile.name,
              description: `Could not analyze image: ${imgError.message}`
            });
          }
        }
      }

      let finalPrompt = '';
      
      if (cleanPrompt) {
        finalPrompt += `User Request: ${cleanPrompt}\n\n`;
      }
      
      if (jsonFiles.length > 0) {
        finalPrompt += '=== JSON DATA TO DISPLAY ===\n\n';
        jsonFiles.forEach((file, index) => {
          const jsonContent = file.fullContent;
          const maxLength = 6000;
          
          if (jsonContent.length > maxLength) {
            let truncatedContent = jsonContent.substring(0, maxLength);
            const lastBrace = Math.max(
              truncatedContent.lastIndexOf('}'),
              truncatedContent.lastIndexOf(']')
            );
            
            if (lastBrace > maxLength * 0.7) {
              truncatedContent = jsonContent.substring(0, lastBrace + 1);
            }
            
            finalPrompt += `${truncatedContent}\n\n`;
          } else {
            finalPrompt += `${jsonContent}\n\n`;
          }
        });
      }
      
      if (imageDescriptions.length > 0) {
        finalPrompt += '=== DESIGN REFERENCE (RECREATE EXACTLY) ===\n\n';
        imageDescriptions.forEach((img, index) => {
          finalPrompt += `DESIGN SPECIFICATION:\n`;
          finalPrompt += `${img.description}\n\n`;
        });
      }
      
      finalPrompt += '\n=== CRITICAL INSTRUCTIONS ===\n\n';
      
      if (imageDescriptions.length > 0) {
        finalPrompt += 'YOUR TASK: Recreate the design from the analysis EXACTLY as described.\n\n';
        finalPrompt += 'REQUIREMENTS:\n';
        finalPrompt += '1. Container width MUST be exactly 600px\n';
        finalPrompt += '2. Center the container horizontally on the page\n';
        finalPrompt += '3. Match EXACT layout structure from the design analysis\n';
        finalPrompt += '4. Use EXACT colors from the analysis:\n';
        finalPrompt += '   - Apply exact hex codes for backgrounds, text, and borders\n';
        finalPrompt += '   - Match color intensity and opacity\n';
        finalPrompt += '   - Preserve color hierarchy and contrast\n';
        finalPrompt += '5. Border styling MUST match exactly:\n';
        finalPrompt += '   - Use exact border-width, border-style, and border-color\n';
        finalPrompt += '   - Apply borders to matching elements (cards, sections, dividers)\n';
        finalPrompt += '   - Match border-radius values precisely\n';
        finalPrompt += '6. Background colors MUST be applied correctly:\n';
        finalPrompt += '   - Page background\n';
        finalPrompt += '   - Section backgrounds\n';
        finalPrompt += '   - Card/container backgrounds\n';
        finalPrompt += '   - Button backgrounds\n';
        finalPrompt += '   - Header/footer backgrounds\n';
        finalPrompt += '7. Text colors MUST match the reference:\n';
        finalPrompt += '   - Heading colors\n';
        finalPrompt += '   - Body text colors\n';
        finalPrompt += '   - Link colors\n';
        finalPrompt += '   - Label colors\n';
        finalPrompt += '8. Recreate ALL UI components exactly as analyzed\n';
        finalPrompt += '9. Match dimensions and proportions precisely (scaled to 600px width)\n';
        finalPrompt += '10. Apply exact shadows, gradients, and visual effects\n';
        finalPrompt += '11. DO NOT include any reference images in the HTML\n';
        finalPrompt += '12. DO NOT use <img> tags - recreate design using HTML/CSS only\n';
        finalPrompt += '13. Add descriptive alt attributes to any icon placeholders or decorative elements\n';
      } else {
        finalPrompt += 'YOUR TASK: Create a professional HTML page displaying the JSON data.\n\n';
        finalPrompt += 'REQUIREMENTS:\n';
        finalPrompt += '1. Container width MUST be exactly 600px\n';
        finalPrompt += '2. Center the container horizontally on the page\n';
        finalPrompt += '3. Professional, clean design with proper color scheme\n';
        finalPrompt += '4. Display JSON data in organized format\n';
        finalPrompt += '5. Use semantic HTML with descriptive alt text for visual elements\n';
      }
      
      if (jsonFiles.length > 0) {
        finalPrompt += '14. Display JSON data in the same style/format as the reference design\n';
        finalPrompt += '15. Integrate JSON data into matching UI components (tables, cards, lists)\n';
        finalPrompt += '16. Maintain consistent color scheme for data display elements\n';
      }
      
      finalPrompt += '\nOUTPUT FORMAT:\n';
      finalPrompt += '- Complete HTML5 document starting with <!DOCTYPE html>\n';
      finalPrompt += '- ALL CSS must be inline in <style> tag\n';
      finalPrompt += '- Main container: max-width: 600px; margin: 0 auto;\n';
      finalPrompt += '- Must be pixel-perfect match to the reference design\n';
      finalPrompt += '- Color values must be exact (use hex codes from analysis)\n';
      finalPrompt += '- Border properties must match reference exactly\n';
      finalPrompt += '- Background colors must be applied to all matching elements\n';
      finalPrompt += '- Add appropriate alt text for decorative elements and icons\n';
      finalPrompt += '- Add padding on body for better appearance\n';
      finalPrompt += '- NO explanations, NO markdown, ONLY HTML code\n';
      finalPrompt += '- DO NOT include any <img> tags or image files\n\n';
      finalPrompt += 'START GENERATING THE HTML NOW:';

      console.log('Final prompt length:', finalPrompt.length);
      console.log('Generating 600px width HTML with exact color and border matching...');
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: 'You are an expert front-end developer specializing in pixel-perfect HTML/CSS recreation. When given a design description, you recreate it EXACTLY with a 600px width container - matching colors (backgrounds, text, borders), layout, spacing, typography, borders, shadows, and all visual elements precisely. You extract and apply EXACT hex color codes from the design analysis. You meticulously apply border styles (width, style, color, radius) to all matching elements. You ensure background colors are applied to page, sections, cards, buttons, and all containers as specified. You NEVER include image files or <img> tags, only recreate designs using HTML/CSS. You add descriptive alt attributes to icon placeholders and decorative elements. You output ONLY clean HTML code with inline CSS, no explanations. The main container MUST always be max-width: 600px with margin: 0 auto for centering.'
                },
                {
                  text: finalPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            topP: 1,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
  
      if (response.data && response.data.candidates && response.data.candidates[0]) {
        console.log('HTML generation successful');
        let htmlContent = response.data.candidates[0].content.parts[0].text;
        
        htmlContent = htmlContent.replace(/```html\n?/gi, '');
        htmlContent = htmlContent.replace(/```\n?/g, '');
        htmlContent = htmlContent.trim();
        htmlContent = htmlContent.replace(/<img[^>]*>/gi, '');
        
        return htmlContent;
      } else {
        console.log('Unexpected response structure:', response.data);
        return 'Sorry, I received an unexpected response format.';
      }
      
    } catch (error) {
      console.error('Gemini API Error:', error);
      
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        return 'Error: Invalid API key. Please check your Gemini API key.';
      } else if (error.response?.status === 429) {
        return 'Error: Rate limit exceeded. Please try again in a moment.';
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error?.message || 'Bad request';
        return `Error: ${errorMsg}. Try with smaller files or simpler prompts.`;
      } else if (error.response?.status === 413) {
        return 'Error: Files too large. Please use smaller JSON files (under 50KB) and images (under 2MB).';
      } else if (error.response?.status >= 500) {
        return 'Error: Server error. Please try again in a moment.';
      } else if (!navigator.onLine) {
        return 'Error: No internet connection.';
      }
      
      return 'Error generating HTML. Please try with smaller files or contact support.';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!prompt.trim() && uploadedFiles.length === 0) || isLoading) return;
  
    console.log('Submitting message...');
    console.log('Prompt:', prompt);
    console.log('Uploaded files:', uploadedFiles);
  
    // Check for "start" command
    let effectivePrompt = prompt;
    let displayMessage = prompt || 'Analyze the uploaded files';
    
    if (prompt.trim().toLowerCase() === 'start') {
      const hasJSON = uploadedFiles.some(f => f.type === 'json');
      const hasImage = uploadedFiles.some(f => f.type === 'image');
      
      if (!hasJSON || !hasImage) {
        alert('Please upload both a JSON file and an image before using the "start" command.');
        return;
      }
      
      effectivePrompt = "Generate responsive HTML code for mailer only with inline css don't include tags (h, p, span, div) also don't add margin or padding for space instead of add blank td with height except button for button add line-height, read properties and structure from json and for reference use image";
      displayMessage = "Code generation started, please wait...";
    }
  
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: displayMessage,
      timestamp: new Date().toLocaleTimeString(),
      files: [...uploadedFiles]
    };
  
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    const currentPrompt = effectivePrompt;
    const currentFiles = [...uploadedFiles];
    setPrompt('');
    setUploadedFiles([]);
  
    try {
      const aiResponse = await callGeminiAPI(currentPrompt, currentFiles);
      
      // Check if response is HTML
      const isHTMLResponse = aiResponse.trim().toLowerCase().startsWith('<!doctype html') || 
                            aiResponse.trim().toLowerCase().startsWith('<html');
      
      // If HTML is generated, show success message instead of HTML code
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: isHTMLResponse ? 'HTML code generated successfully ✓' : aiResponse,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Set the generated HTML for preview/download
      if (isHTMLResponse) {
        setGeneratedHTML(aiResponse);
        setEditableCode(aiResponse);
        setViewMode('preview');
      }
    } catch (error) {
      console.error('Handle Submit Error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setUploadedFiles([]);
    setGeneratedHTML('');
    setEditableCode('');
    setViewMode('preview');
  };

  const handleDownload = () => {
    const htmlToDownload = editableCode || generatedHTML;
    if (!htmlToDownload) return;

    const blob = new Blob([htmlToDownload], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-page-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCodeChange = (e) => {
    setEditableCode(e.target.value);
  };

  const applyCodeChanges = () => {
    setGeneratedHTML(editableCode);
    setViewMode('preview');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">
            <img src={logoSvg} alt={getRandomAltText('robot')} />
          </h1>
          <button onClick={clearChat} className="clear-btn">Back to Home
    
          </button>
        </div>
      </header>

      <main className="main-content split-layout">
        {/* Left Panel - Input */}
        <div className={`input-panel ${generatedHTML ? 'has-output' : ''}`}>
          <div className="chat-container">
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="welcome-message">
                  <div className="icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg></div>
                  <p>Start Generating</p>
                  <div className="file-info-container">
                    <p className="file-info">Upload a screenshot + Figma JSON, <br />and type start in text field.
                      </p>
                  </div>
                </div>
              ) : (
                <div className="messages-list">
                  {messages.map((message) => (
                    <div key={message.id} className={`message ${message.type}-message`}>
                      <div className="message-avatar" role="img" aria-label={getRandomAltText(message.type === 'user' ? 'user' : 'robot')}>
                        {message.type === 'user' ? '👤' : '🤖'}
                      </div>
                      <div className="message-content">
                        {message.files && message.files.length > 0 && (
                          <div className="message-files">
                            {message.files.map(file => (
                              <div key={file.id} className="file-preview-small">
                                {file.type === 'image' ? (
                                  <>
                                    <img src={file.preview} alt={`${getRandomAltText('image')} - ${file.name}`} className="preview-img-small" />
                                    <span className="file-name-small">{file.name}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="file-icon" role="img" aria-label={getRandomAltText('file')}>📄</span>
                                    <span className="file-name-small">{file.name}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="message-text">
                          {message.content.split('\n').map((line, index) => (
                            <React.Fragment key={index}>
                              {line}
                              {index < message.content.split('\n').length - 1 && <br />}
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="message-time">{message.timestamp}</div>
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="message ai-message loading-message">
                      <div className="message-avatar" role="img" aria-label={getRandomAltText('robot')}>🤖</div>
                      <div className="message-content">
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <div className="message-time">Analyzing files and generating response...</div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="uploaded-files-preview">
                <div className="files-header">
                  <span className="files-count">
                    <span role="img" aria-label="Attachment icon">📎</span> {uploadedFiles.length} file(s) ready to analyze
                  </span>
                </div>
                <div className="files-grid">
                  {uploadedFiles.map(file => (
                    <div key={file.id} className="file-preview-item">
                      {file.type === 'image' ? (
                        <img src={file.preview} alt={`${getRandomAltText('image')} - ${file.name}`} className="preview-image" />
                      ) : (
                        <div className="json-preview">
                          <span className="file-icon-large" role="img" aria-label={getRandomAltText('file')}>📄</span>
                          <pre className="json-content">{file.preview}</pre>
                        </div>
                      )}
                      <div className="file-info-bar">
                        <span className="file-name" title={file.name}>{file.name}</span>
                        <button 
                          onClick={() => removeFile(file.id)} 
                          className="remove-file-btn"
                          type="button"
                          title="Remove file"
                          aria-label={`Remove ${file.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="input-form">
              <div className="input-container">
                <input
                  type="file"
                  ref={jsonFileInputRef}
                  onChange={handleJSONUpload}
                  accept=".json,application/json"
                  multiple
                  style={{ display: 'none' }}
                  aria-label="Upload JSON file"
                />
                <input
                  type="file"
                  ref={imageFileInputRef}
                  onChange={handleImageUpload}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  style={{ display: 'none' }}
                  aria-label="Upload image file"
                />
                
                <div className="upload-buttons">
                  <button
                    type="button"
                    onClick={() => jsonFileInputRef.current?.click()}
                    className="upload-btn json-btn"
                    disabled={isLoading}
                    title="Upload JSON file"
                    aria-label="Upload JSON file"
                  >
                    <span className="btn-icon" role="img" aria-label={getRandomAltText('file')}>📄</span>
                    <span className="btn-text">Figma JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="upload-btn image-btn"
                    disabled={isLoading}
                    title="Upload Image"
                    aria-label="Upload image file"
                  >
                    <span className="btn-icon" role="img" aria-label={getRandomAltText('image')}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image w-4 h-4 mr-1" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg></span>
                    <span className="btn-text">Screenshot</span>
                  </button>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={uploadedFiles.length > 0 ? "Ask a question about your uploaded files..." : "Upload both files and type 'start'..."}
                  className="message-input"
                  rows="1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={isLoading}
                  aria-label="Message input"
                />
                <button 
  type="submit" 
  className="send-button"
  disabled={
    isLoading || 
    (
      !prompt.trim() && 
      uploadedFiles.length === 0
    ) || 
    (
      prompt.trim() && 
      prompt.trim().toLowerCase() !== 'start' && 
      uploadedFiles.length === 0
    )
  }
  aria-label="Send message"
>
                  {isLoading ? (
                  <div className="loading-spinner" role="status" aria-label="Loading"></div>
                  ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  )}
                  </button>
                  </div>
                  </form>
                  </div>
                  </div>

                  {/* Right Panel - Output */}
    {generatedHTML && (
      <div className="output-panel">
        <div className="output-header">
          <div className="output-tabs">
            <button
              className={`tab-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
              aria-label="Preview mode"
            >
              <span role="img" aria-label="Preview icon">👁️</span> HTML View
            </button>
            <button
              className={`tab-btn ${viewMode === 'code' ? 'active' : ''}`}
              onClick={() => setViewMode('code')}
              aria-label="Code editor mode"
            >
              <span role="img" aria-label="Code icon">💻</span> Edit Code
            </button>
          </div>
          <button
            className="download-btn"
            onClick={handleDownload}
            title="Download HTML file"
            aria-label="Download HTML file"
          >
            <span role="img" aria-label="Download icon">⬇️</span> Download
          </button>
        </div>

        <div className="output-content">
          {viewMode === 'preview' ? (
            <iframe
              ref={iframeRef}
              title="HTML Preview"
              className="preview-iframe"
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="code-editor-container">
              <textarea
                className="code-editor"
                value={editableCode}
                onChange={handleCodeChange}
                spellCheck="false"
                aria-label="HTML code editor"
              />
              <button
                className="apply-changes-btn"
                onClick={applyCodeChanges}
                aria-label="Apply code changes"
              >
                Apply Changes
              </button>
            </div>
          )}
        </div>
      </div>
    )}
  </main>
</div>
);
}
export default App;
