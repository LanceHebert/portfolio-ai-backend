const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = "gpt-3.5-turbo"; // Cheapest model

// Usage Limits (Conservative estimates for $5 credit)
const USAGE_LIMITS = {
  DAILY_REQUESTS: 50, // Conservative daily limit
  MONTHLY_REQUESTS: 1000, // Conservative monthly limit
  MAX_TOKENS_PER_REQUEST: 500, // Limit response length
  COST_PER_1K_TOKENS: 0.002, // GPT-3.5-turbo cost
  MAX_MONTHLY_COST: 4.5, // Leave $0.50 buffer
  LIFETIME_SPEND_LIMIT: 5.0, // Permanent $5 limit - NEVER exceed this
};

// Usage tracking (in production, use a database)
let usageStats = {
  dailyRequests: 0,
  monthlyRequests: 0,
  totalCost: 0,
  lifetimeSpend: 0, // Track total lifetime spending
  lastReset: new Date(),
  openaiDisabled: false, // Flag to permanently disable OpenAI
};

// Reset usage counters daily/monthly
function resetUsageCounters() {
  const now = new Date();
  const lastReset = new Date(usageStats.lastReset);

  // Reset daily counter if it's a new day
  if (
    now.getDate() !== lastReset.getDate() ||
    now.getMonth() !== lastReset.getMonth()
  ) {
    usageStats.dailyRequests = 0;
  }

  // Reset monthly counter if it's a new month
  if (now.getMonth() !== lastReset.getMonth()) {
    usageStats.monthlyRequests = 0;
    usageStats.totalCost = 0;
  }

  usageStats.lastReset = now;
}

// Check if we can make an OpenAI request
function canMakeOpenAIRequest() {
  resetUsageCounters();

  // PERMANENT LIFETIME LIMIT - If we've ever spent $5, never use OpenAI again
  if (usageStats.lifetimeSpend >= USAGE_LIMITS.LIFETIME_SPEND_LIMIT) {
    if (!usageStats.openaiDisabled) {
      console.log(
        "🚨 LIFETIME SPEND LIMIT REACHED: OpenAI permanently disabled"
      );
      usageStats.openaiDisabled = true;
    }
    return false;
  }

  // Check daily limit
  if (usageStats.dailyRequests >= USAGE_LIMITS.DAILY_REQUESTS) {
    console.log("Daily request limit reached");
    return false;
  }

  // Check monthly limit
  if (usageStats.monthlyRequests >= USAGE_LIMITS.MONTHLY_REQUESTS) {
    console.log("Monthly request limit reached");
    return false;
  }

  // Check cost limit (conservative estimate)
  const estimatedMonthlyCost =
    usageStats.totalCost + USAGE_LIMITS.COST_PER_1K_TOKENS * 0.5; // Estimate 500 tokens per request
  if (estimatedMonthlyCost >= USAGE_LIMITS.MAX_MONTHLY_COST) {
    console.log("Monthly cost limit reached");
    return false;
  }

  return true;
}

// Update usage stats
function updateUsageStats(tokensUsed) {
  usageStats.dailyRequests++;
  usageStats.monthlyRequests++;

  // Calculate cost (rough estimate)
  const cost = (tokensUsed / 1000) * USAGE_LIMITS.COST_PER_1K_TOKENS;
  usageStats.totalCost += cost;
  usageStats.lifetimeSpend += cost; // Track lifetime spending

  console.log(
    `Usage: Daily: ${usageStats.dailyRequests}/${
      USAGE_LIMITS.DAILY_REQUESTS
    }, Monthly: ${usageStats.monthlyRequests}/${
      USAGE_LIMITS.MONTHLY_REQUESTS
    }, Monthly Cost: $${usageStats.totalCost.toFixed(
      4
    )}, LIFETIME: $${usageStats.lifetimeSpend.toFixed(4)}/${
      USAGE_LIMITS.LIFETIME_SPEND_LIMIT
    }`
  );

  // Check if we've hit the lifetime limit
  if (usageStats.lifetimeSpend >= USAGE_LIMITS.LIFETIME_SPEND_LIMIT) {
    console.log("🚨 LIFETIME SPEND LIMIT REACHED: OpenAI permanently disabled");
    usageStats.openaiDisabled = true;
  }
}

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
- Languages: JavaScript, Ruby
- Frameworks: Ruby on Rails, React, HTML5, CSS3, Bootstrap
- CMS & APIs: Contentful (Headless CMS), REST
- Database Management: PostgreSQL, SQLite
- Performance & Accessibility: Lighthouse, WCAG 2.1 AA
- Testing & Workflow: Git, Postman
- Tools: Foundation CSS, Bootstrap

INTERESTS & PASSIONS:
- Web3/cryptocurrencies/blockchain
- Health hacking
- Augmented reality
- AI and machine learning

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

AI-Powered Portfolio Chatbot
- Developed an intelligent AI chatbot integrated into his portfolio website using OpenAI GPT-3.5-turbo API
- Implemented cost-effective architecture with fallback responses and strict spending limits ($5 lifetime budget)
- Built with React frontend, Node.js/Express backend, deployed on Railway with comprehensive usage tracking
- Features include smart conversation flow, 40+ trigger phrases for detailed responses, and bulletproof cost protection
- Demonstrates full-stack development skills, API integration, and modern deployment practices

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

BACKGROUND:
Lance is a physical therapist turned software developer residing in Washington State. The "Pandemic Pivot" allowed him to reassess his career choice and start pursuing something he is passionate about. He is excited to integrate his leadership background in healthcare with the knowledge he has gained in Ruby on Rails and JavaScript React based programming.

Be helpful, professional, and enthusiastic about Lance's work. Provide detailed, accurate information about his skills, projects, and experience. Keep responses informative and engaging.`;

// Fallback responses when OpenAI is not available
const FALLBACK_RESPONSES = {
  experience:
    "Lance is a Software Engineer with 3+ years of experience in JavaScript and Ruby on Rails. He specializes in WCAG compliance and performance optimization, having boosted client Lighthouse scores from 45% to 90+%. He's worked at VOGLIO Marketing building high-performance web applications and mentoring other developers.",
  skills:
    "Lance's Technical Skills:\n\n- Languages: JavaScript, Ruby\n- Frameworks: Ruby on Rails, React, HTML5, CSS3, Bootstrap\n- Database Management: PostgreSQL, SQLite\n- CMS: Contentful (Headless CMS)\n- Performance: Lighthouse, WCAG 2.1 AA compliance\n- Testing & Workflow: Git, Postman\n- Tools: Foundation CSS, Bootstrap\n\nHe's particularly strong in accessibility, performance optimization, and full-stack development!",
  projects:
    "Lance has built several impressive projects:\n\n1. AI-Powered Portfolio Chatbot - Intelligent chatbot using OpenAI GPT-3.5-turbo with cost-effective architecture and smart conversation flow\n2. Ad Skipping Browser Extension for YouTube - Chrome extension with 607 impressions and 23 active users\n3. Physical Therapy Exercise Injury Prevention App - Full-stack app with PostgreSQL and React\n\nAll projects showcase his full-stack development skills and modern technology expertise!",
  contact:
    "You can connect with Lance through:\n\n- Email: LSUHEBERT@gmail.com\n- Phone: 281-703-1477\n- LinkedIn: linkedin.com/in/Lance-Hebert\n- GitHub: github.com/lancehebert\n- Website: www.lance-hebert.com\n\nHe's always excited to discuss new opportunities!",
  default:
    "Hi! I'm Lance's AI assistant. I can help you learn about his professional background! You can ask me about:\n\n- Experience & Work History\n- Technical Skills & Technologies\n- Projects & Portfolio\n- Contact Information\n- Education & Background\n- Interests & Passions\n\nWhat would you like to know about Lance?",
  limitReached:
    "I'm currently experiencing high usage and need to conserve resources. I can still help you with information about Lance using my built-in knowledge! You can ask me about:\n\n- Experience & Work History\n- Technical Skills & Technologies\n- Projects & Portfolio\n- Contact Information\n- Education & Background\n- Interests & Passions\n\nWhat would you like to know about Lance?",
};

// Function to call OpenAI API
async function callOpenAI(message) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Check usage limits before making request
    if (!canMakeOpenAIRequest()) {
      throw new Error("Usage limit reached");
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
        max_tokens: USAGE_LIMITS.MAX_TOKENS_PER_REQUEST,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Update usage stats with actual token usage
    const tokensUsed = response.data.usage.total_tokens;
    updateUsageStats(tokensUsed);

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API error:", error.message);
    throw error;
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Portfolio AI Backend is running!",
    usage: {
      dailyRequests: usageStats.dailyRequests,
      monthlyRequests: usageStats.monthlyRequests,
      totalCost: usageStats.totalCost,
      lifetimeSpend: usageStats.lifetimeSpend,
      openaiDisabled: usageStats.openaiDisabled,
      limits: USAGE_LIMITS,
    },
  });
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
    const lowerMessage = message.toLowerCase();

    // Check if user is asking for more detailed help or clarification
    const needsOpenAI =
      lowerMessage.includes("more detail") ||
      lowerMessage.includes("explain more") ||
      lowerMessage.includes("tell me more") ||
      lowerMessage.includes("elaborate") ||
      lowerMessage.includes("can you help me") ||
      lowerMessage.includes("i need help") ||
      lowerMessage.includes("chatgpt") ||
      lowerMessage.includes("ai") ||
      lowerMessage.includes("investigate") ||
      lowerMessage.includes("further") ||
      lowerMessage.includes("detailed") ||
      lowerMessage.includes("specific") ||
      lowerMessage.includes("no") ||
      lowerMessage.includes("not really") ||
      lowerMessage.includes("didn't answer") ||
      lowerMessage.includes("didnt answer") ||
      lowerMessage.includes("that didn't help") ||
      lowerMessage.includes("that didnt help") ||
      lowerMessage.includes("not what i was looking for") ||
      lowerMessage.includes("not what i wanted") ||
      lowerMessage.includes("i want to know") ||
      lowerMessage.includes("i need to know") ||
      lowerMessage.includes("can you find") ||
      lowerMessage.includes("search for") ||
      lowerMessage.includes("look up") ||
      lowerMessage.includes("research") ||
      lowerMessage.includes("dig deeper") ||
      lowerMessage.includes("go deeper") ||
      lowerMessage.includes("expand on") ||
      lowerMessage.includes("break down") ||
      lowerMessage.includes("analyze") ||
      lowerMessage.includes("compare") ||
      lowerMessage.includes("difference") ||
      lowerMessage.includes("similarities") ||
      lowerMessage.includes("how does") ||
      lowerMessage.includes("why does") ||
      lowerMessage.includes("what makes") ||
      lowerMessage.includes("explain how") ||
      lowerMessage.includes("walk me through") ||
      lowerMessage.includes("step by step") ||
      lowerMessage.includes("in depth") ||
      lowerMessage.includes("comprehensive") ||
      lowerMessage.includes("thorough") ||
      lowerMessage.includes("complete") ||
      lowerMessage.includes("full") ||
      lowerMessage.includes("extensive");

    // Handle OpenAI requests first (including "no" responses)
    if (needsOpenAI) {
      // User specifically asked for more detail - try OpenAI if available and within limits
      if (
        OPENAI_API_KEY &&
        canMakeOpenAIRequest() &&
        !usageStats.openaiDisabled
      ) {
        try {
          // If user just said "no" or similar, ask for clarification first
          if (
            lowerMessage.includes("no") ||
            lowerMessage.includes("not really") ||
            lowerMessage.includes("didn't answer") ||
            lowerMessage.includes("didnt answer") ||
            lowerMessage.includes("that didn't help") ||
            lowerMessage.includes("that didnt help")
          ) {
            response =
              "I'd be happy to help you find more specific information! What exactly would you like to know about Lance? For example:\n\n- More details about his work at VOGLIO Marketing?\n- Specific technical skills or technologies?\n- Information about his projects?\n- His approach to accessibility and performance?\n- His mentoring and leadership experience?\n\nJust let me know what interests you most!";
            note = "Asking for clarification before using OpenAI";
          } else {
            // User provided specific details, use OpenAI
            const openaiResponse = await callOpenAI(message);
            response = openaiResponse;
            note = "Using OpenAI GPT-3.5-turbo (detailed response)";
          }
        } catch (openaiError) {
          console.error(
            "OpenAI failed, keeping fallback:",
            openaiError.message
          );

          if (openaiError.message === "Usage limit reached") {
            response =
              FALLBACK_RESPONSES.default +
              "\n\nI'm currently at my usage limit, but I can still help with the information above! Feel free to ask specific questions about Lance's background.";
            note = "Using fallback response (usage limit reached)";
          } else {
            response =
              FALLBACK_RESPONSES.default +
              "\n\nI'm having trouble accessing my detailed response system, but I can still help with the information above!";
            note = "Using fallback response (OpenAI failed)";
          }
        }
      } else {
        // No OpenAI, limits reached, or lifetime limit exceeded
        if (usageStats.openaiDisabled) {
          response =
            FALLBACK_RESPONSES.default +
            "\n\nI've reached my lifetime usage limit and can no longer provide detailed AI responses. However, I can still help with the information above! Feel free to ask specific questions about Lance's background.";
          note = "Using fallback response (lifetime spend limit reached)";
        } else if (!OPENAI_API_KEY) {
          response =
            FALLBACK_RESPONSES.default +
            "\n\nI'm currently conserving resources, but I can still help with the information above! Feel free to ask specific questions about Lance's background.";
          note = "Using fallback response (OpenAI not configured)";
        } else {
          response =
            FALLBACK_RESPONSES.default +
            "\n\nI'm currently at my usage limit, but I can still help with the information above! Feel free to ask specific questions about Lance's background.";
          note = "Using fallback response (usage limit reached)";
        }
      }
    } else {
      // Use fallback responses by default (cost-effective)
      if (
        lowerMessage.includes("experience") ||
        lowerMessage.includes("work")
      ) {
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

      // Add follow-up question to encourage OpenAI usage only when needed
      response +=
        "\n\nDid that answer your question, or would you like me to investigate further with more detailed information?";
      note = "Using fallback response (default mode)";
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
  console.log(
    `💰 Usage limits: ${USAGE_LIMITS.DAILY_REQUESTS} daily, ${USAGE_LIMITS.MONTHLY_REQUESTS} monthly, $${USAGE_LIMITS.MAX_MONTHLY_COST} max cost, $${USAGE_LIMITS.LIFETIME_SPEND_LIMIT} lifetime spend limit`
  );
});
