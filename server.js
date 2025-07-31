const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = "gpt-3.5-turbo"; // Cheapest model

// Middleware
app.use(cors());
app.use(express.json());

// Lance's resume information
const LANCE_CONTEXT = `You are Lance Hebert's AI assistant. You help visitors learn about Lance's professional background, skills, and projects.

CONTACT INFORMATION:
- Location: Renton, WA
- Phone: 281-703-1477
- Email: LSUHEBERT@gmail.com
- GitHub: github.com/lancehebert
- Website: www.lance-hebert.com
- LinkedIn: linkedin.com/in/Lance-Hebert

EXECUTIVE SUMMARY:
Lance Hebert is a Software Engineer with 3+ years of hands-on professional experience building high-performance, accessible web applications in JavaScript and Ruby on Rails. He is a go-to expert for WCAG compliance and page-speed optimization—boosting client Lighthouse scores from sub-50% to 90+%. Lance is passionate about clean code, rapid delivery, and mentoring peers to excellence.

TECHNICAL SKILLS:
- Languages & Frameworks: JavaScript, Ruby on Rails
- CMS & APIs: Contentful (Headless CMS), REST
- Performance & Accessibility: Lighthouse, WCAG 2.1 AA
- Tools: Git, HTML5, CSS3, Foundation CSS, Bootstrap

PROFESSIONAL EXPERIENCE:

VOGLIO Marketing (Seattle, WA)
Web Developer II (May 2025 – Jul 2025)
- Audited and remediated legacy code for WCAG 2.1 AA, raising accessibility/performance scores from ~45% to 90+% on client sites
- Mentored and onboarded 2 peer developers; created an internal Slack channel for Rails/Contentful best practices and ran weekly code reviews
- Led performance optimizations (deferred loading, image and file compression, critical-CSS) that improved average Google PageSpeed Insights scores by 40 points

Web Developer (Aug 2022 – May 2025)
- Built custom client websites in JavaScript and Rails, driving lead-generation and conversion improvements for clients with $700M+ in revenue
- Integrated and maintained Contentful (headless CMS) workflows, designing content models and APIs for scalable, multi-channel sites
- Conducted A/B testing to identify result-driven improvements in website performance and user experience, resulting in higher engagement and customer satisfaction
- Maintained AWS S3 buckets and CloudFront distributions to store and serve client assets—images, PDFs, and video—reducing load on origin servers and improving global delivery performance

TECHNICAL PROJECTS:

Ad Skipping Browser Extension for YouTube
- Engineered a forked Chrome extension using JavaScript and the Chrome Extensions API to speed up in-video ads to 15× and toggle playback between 1×/2×/3× via a single (Alt) key
- Published the extension to the Chrome Web Store, achieving 607 impressions and 23 active users within the first month

Physical Therapy Exercise Injury Prevention App
- Utilized Ruby, PostgreSQL, ActiveRecord, and Bcrypt password hashing algorithm to store encrypted user data
- Incorporated Re-charts(recharts.org) and Victory charts to dynamically display variety of charts from user input
- Implemented responsive display for functionality on mobile, tablet and computer screen, React Bootstrap CSS styling
- Integrated unique exercise routines with embedded video based on user selection with responsive HTML input form

EDUCATION:
- Flatiron School (Seattle, WA): Full Stack Web Development, Ruby on Rails and JavaScript program (11/2021 - 3/2022)
- University of Texas Medical Branch (Galveston, TX): Doctor of Physical Therapy (8/2012 - 8/2015)

Be helpful, professional, and enthusiastic about Lance's work. Provide detailed, accurate information about his skills, projects, and experience. Keep responses informative and engaging.`;

// Fallback responses when OpenAI is not available
const FALLBACK_RESPONSES = {
  experience:
    "Lance is a Software Engineer with 3+ years of experience in JavaScript and Ruby on Rails. He specializes in WCAG compliance and performance optimization, having boosted client Lighthouse scores from 45% to 90+%. He's worked at VOGLIO Marketing building high-performance web applications and mentoring other developers.",
  skills:
    "Lance's Technical Skills:\n\n- Languages: JavaScript, Ruby\n- Frameworks: Ruby on Rails, React, HTML5, CSS3\n- CMS: Contentful (Headless CMS)\n- Performance: Lighthouse, WCAG 2.1 AA compliance\n- Tools: Git, Foundation CSS, Bootstrap\n\nHe's particularly strong in accessibility and performance optimization!",
  projects:
    "Lance has built several impressive projects:\n\n1. Ad Skipping Browser Extension for YouTube - Chrome extension with 607 impressions and 23 active users\n2. Physical Therapy Exercise Injury Prevention App - Full-stack app with PostgreSQL and React\n\nAll projects showcase his full-stack development skills!",
  contact:
    "You can connect with Lance through:\n\n- Email: LSUHEBERT@gmail.com\n- Phone: 281-703-1477\n- LinkedIn: linkedin.com/in/Lance-Hebert\n- GitHub: github.com/lancehebert\n- Website: www.lance-hebert.com\n\nHe's always excited to discuss new opportunities!",
  default:
    "Hi! I'm Lance's AI assistant. I can help you learn about his professional background! You can ask me about:\n\n- Experience & Work History\n- Technical Skills & Technologies\n- Projects & Portfolio\n- Contact Information\n- Education & Background\n\nWhat would you like to know about Lance?",
};

// Function to call OpenAI API
async function callOpenAI(message) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: LANCE_CONTEXT,
          },
          {
            role: "user",
            content: message,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API error:", error.message);
    throw error;
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Portfolio AI Backend is running!" });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let response;
    let note = "";

    // Try OpenAI first if API key is available
    if (OPENAI_API_KEY) {
      try {
        response = await callOpenAI(message);
        note = "Using OpenAI GPT-3.5-turbo";
      } catch (openaiError) {
        console.error("OpenAI failed, using fallback:", openaiError.message);
        // Fall back to predefined responses
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes("experience") || lowerMessage.includes("work")) {
          response = FALLBACK_RESPONSES.experience;
        } else if (
          lowerMessage.includes("skills") ||
          lowerMessage.includes("technologies")
        ) {
          response = FALLBACK_RESPONSES.skills;
        } else if (
          lowerMessage.includes("projects") ||
          lowerMessage.includes("portfolio")
        ) {
          response = FALLBACK_RESPONSES.projects;
        } else if (
          lowerMessage.includes("contact") ||
          lowerMessage.includes("email") ||
          lowerMessage.includes("reach")
        ) {
          response = FALLBACK_RESPONSES.contact;
        } else {
          response = FALLBACK_RESPONSES.default;
        }
        note = "Using fallback response (OpenAI failed)";
      }
    } else {
      // No OpenAI API key, use fallback responses
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes("experience") || lowerMessage.includes("work")) {
        response = FALLBACK_RESPONSES.experience;
      } else if (
        lowerMessage.includes("skills") ||
        lowerMessage.includes("technologies")
      ) {
        response = FALLBACK_RESPONSES.skills;
      } else if (
        lowerMessage.includes("projects") ||
        lowerMessage.includes("portfolio")
      ) {
        response = FALLBACK_RESPONSES.projects;
      } else if (
        lowerMessage.includes("contact") ||
        lowerMessage.includes("email") ||
        lowerMessage.includes("reach")
      ) {
        response = FALLBACK_RESPONSES.contact;
      } else {
        response = FALLBACK_RESPONSES.default;
      }
      note = "Using fallback response (OpenAI API key not configured)";
    }

    res.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString(),
      note: note,
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);

    res.json({
      success: true,
      response: FALLBACK_RESPONSES.default,
      timestamp: new Date().toISOString(),
      note: "Using fallback response due to error",
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Portfolio AI Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`🤖 OpenAI configured: ${OPENAI_API_KEY ? "Yes" : "No"}`);
});
