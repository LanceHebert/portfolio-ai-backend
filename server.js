const express = require("express");
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Fallback responses when Ollama is not available
const FALLBACK_RESPONSES = {
  experience: "Lance is a Software Engineer with 3+ years of experience in JavaScript and Ruby on Rails. He specializes in WCAG compliance and performance optimization, having boosted client Lighthouse scores from 45% to 90+%. He's worked at VOGLIO Marketing building high-performance web applications and mentoring other developers.",
  skills: "Lance's Technical Skills:\n\n- Languages: JavaScript, Ruby\n- Frameworks: Ruby on Rails, React, HTML5, CSS3\n- CMS: Contentful (Headless CMS)\n- Performance: Lighthouse, WCAG 2.1 AA compliance\n- Tools: Git, Foundation CSS, Bootstrap\n\nHe's particularly strong in accessibility and performance optimization!",
  projects: "Lance has built several impressive projects:\n\n1. Ad Skipping Browser Extension for YouTube - Chrome extension with 607 impressions and 23 active users\n2. Physical Therapy Exercise Injury Prevention App - Full-stack app with PostgreSQL and React\n\nAll projects showcase his full-stack development skills!",
  contact: "You can connect with Lance through:\n\n- Email: LSUHEBERT@gmail.com\n- Phone: 281-703-1477\n- LinkedIn: linkedin.com/in/Lance-Hebert\n- GitHub: github.com/lancehebert\n- Website: www.lance-hebert.com\n\nHe's always excited to discuss new opportunities!",
  default: "Hi! I'm Lance's AI assistant. I can help you learn about his professional background! You can ask me about:\n\n- Experience & Work History\n- Technical Skills & Technologies\n- Projects & Portfolio\n- Contact Information\n- Education & Background\n\nWhat would you like to know about Lance?"
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Portfolio AI Backend is running!' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // For now, always use fallback responses since Ollama isn't available on Railway
    const lowerMessage = message.toLowerCase();
    let response;

    if (lowerMessage.includes('experience') || lowerMessage.includes('work')) {
      response = FALLBACK_RESPONSES.experience;
    } else if (lowerMessage.includes('skills') || lowerMessage.includes('technologies')) {
      response = FALLBACK_RESPONSES.skills;
    } else if (lowerMessage.includes('projects') || lowerMessage.includes('portfolio')) {
      response = FALLBACK_RESPONSES.projects;
    } else if (lowerMessage.includes('contact') || lowerMessage.includes('email') || lowerMessage.includes('reach')) {
      response = FALLBACK_RESPONSES.contact;
    } else {
      response = FALLBACK_RESPONSES.default;
    }

    res.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString(),
      note: "Using fallback response (Ollama not available on Railway)"
    });

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    
    res.json({
      success: true,
      response: FALLBACK_RESPONSES.default,
      timestamp: new Date().toISOString(),
      note: "Using fallback response due to error"
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Portfolio AI Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
});
