const express = require("express");
const cors = require("cors");
const axios = require("axios");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const winston = require("winston");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "portfolio-backend" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://lance-hebert.com",
            "https://www.lance-hebert.com",
            "https://portfolio-ai-backend-production-1fa0.up.railway.app",
          ] // Update these with your actual production domains
        : ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" })); // Limit request body size

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
  LIFETIME_SPEND_LIMIT: 4.0, // Switch to fallback mode at $4, leaving $1 buffer
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
      logger.warn("LIFETIME SPEND LIMIT REACHED: OpenAI permanently disabled");
      usageStats.openaiDisabled = true;
    }
    return false;
  }

  // Check daily limit
  if (usageStats.dailyRequests >= USAGE_LIMITS.DAILY_REQUESTS) {
    logger.info("Daily request limit reached");
    return false;
  }

  // Check monthly limit
  if (usageStats.monthlyRequests >= USAGE_LIMITS.MONTHLY_REQUESTS) {
    logger.info("Monthly request limit reached");
    return false;
  }

  // Check cost limit (conservative estimate)
  const estimatedMonthlyCost =
    usageStats.totalCost + USAGE_LIMITS.COST_PER_1K_TOKENS * 0.5; // Estimate 500 tokens per request
  if (estimatedMonthlyCost >= USAGE_LIMITS.MAX_MONTHLY_COST) {
    logger.info("Monthly cost limit reached");
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

  logger.info(
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
    logger.warn("LIFETIME SPEND LIMIT REACHED: OpenAI permanently disabled");
    usageStats.openaiDisabled = true;
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Lance's resume information
const LANCE_CONTEXT = `IMPORTANT: You must ONLY use the information provided below. Do NOT make up, invent, or hallucinate any information about Lance Hebert that is not explicitly stated in this context. If you don't have specific information about something, say "I don't have specific information about that" rather than guessing.

RESPONSE GUIDELINES:
- Only use factual information from Lance's resume and portfolio
- If asked about something not covered, admit you don't have that information
- Be helpful and professional while staying within the provided context
- You are ChadGPT (or Chad for short), Lance's AI assistant

ABOUT CHADGPT:
- Name: ChadGPT (or Chad for short)
- Role: Lance Hebert's AI assistant
- Purpose: Help visitors learn about Lance's professional background, skills, and experience
- Personality: Professional, helpful, and accurate
- Knowledge Base: Lance's resume, portfolio, and professional information

LANCE HEBERT - PROFESSIONAL BACKGROUND:

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
- Database Management: PostgreSQL, SQLite
- CMS & APIs: Contentful (Headless CMS), REST
- Performance & Accessibility: Lighthouse, WCAG 2.1 AA
- Testing & Workflow: Git, Postman
- Deployment & Cloud: Heroku, Netlify, Railway, AWS S3, CloudFront
- Tools: Foundation CSS, Bootstrap

INTERESTS & PASSIONS:
- Web3/cryptocurrencies/blockchain
- Health hacking
- Augmented reality
- AI and machine learning
- Computer gaming
- Working out at the gym
- Playing ice hockey

PROFESSIONAL EXPERIENCE:

VOGLIO Marketing (Seattle, WA)
Web Developer II (May 2025 – Jul 2025) · 3 months
- Became subject-matter expert on web accessibility standards (WCAG 2.1 AA), auditing and remediating legacy code to boost accessibility scores from ~45% to 90+% across top client sites
- Integrated and maintained headless CMS workflows using Contentful—building custom delivery APIs, content models, and editing tools to support scalable, multi-channel web applications
- Mentored and onboarded 2 peer developers and created an internal Slack channel for rapid Rails/Contentful support and knowledge sharing
- Led performance optimization initiatives—implementing deferred loading, image and file compression and critical-CSS inlining—to improve average Google PageSpeed scores by 40 points

Web Developer (Aug 2022 – May 2025) · 2 years 10 months
- Developed custom websites in JavaScript and Ruby on Rails that drove business outcomes, such as increased lead generation and higher conversion rates for clients with over 700 million in net revenue
- Conducted A/B testing to identify result-driven improvements in website performance and user experience, resulting in higher engagement and customer satisfaction
- Collaborated with cross-functional teams to deliver complex projects on time and within budget, exceeding client expectations
- Crafted clean, efficient, and scalable code in JavaScript and Ruby on Rails that optimized website performance and search engine rankings
- Provided exceptional technical support and maintenance services to clients, resulting in long-term partnerships and repeat business

EDUCATION & CERTIFICATION:
Flatiron School (Seattle, WA)
Software Engineer Certification (Nov 2021 – Mar 2022) · 5 months
- Full-time intensive boot camp cultivating fluency in multiple languages, frameworks, and skills to become a full-stack software engineer
- Front-end: JavaScript (ES6+), React.js, Bootstrap, HTML, CSS
- Back-end: Ruby, Ruby on Rails, ActiveRecord, SQL, SQLite, PostgreSQL

BOOTCAMP TECHNICAL PROJECTS:
Physical Therapy Exercise Injury Prevention App
- Utilized Ruby, PostgreSQL, ActiveRecord, and Bcrypt password hashing algorithm to manage encrypted user information and store user data
- Incorporated Re-charts(recharts.org) and Victory charts to dynamically display variety of charts from user input
- Implemented responsive display for functionality on mobile, tablet and computer screen, React Bootstrap CSS styling
- Integrated unique exercise routines with embedded video based on user selection with responsive HTML input form

Dungeons and Dragons Inspired Character Builder
- Created authorization/authentication of user with PostgreSQL backend using MVC model
- Designed React beautiful dnd beautiful framework menu as well as CSS Lightbox display of character animation
- Devised randomization of character starter gear and weapons from database with Ruby on Rails

Podcast Recommending/Liking App
- Harnessed Spotify API to allow users to search podcasts with 50 search results per fetch
- Employed a JSON server backend for persistent "likes" per user
- Built various CSS stylings to display episodes fetched from Spotify API dynamically using React Bootstrap

HEALTHCARE BACKGROUND:
Assured Home Healthcare (2019 – 2020) · 1 year
Physical Therapist
- Extensive training in PDGM changes and its effect on pragmatic healthcare
- Supervision and delegation of physical therapy assistants to provide appropriate care to patients under clinical management
- Multi-disciplinary collaboration with administrative staff, physicians, and colleagues to facilitate cohesive care
- Timely documentation within 24 hours of service including start of care reports
- Autonomous management of schedule as well as orders from physicians for prompt, well maintained service

Signature Healthcare at Home (May 2018 – May 2019) · 1 year 1 month
Home Health Physical Therapist
- Supervision and delegation of physical therapist assistants to provide appropriate care to patients under clinical management
- Multi-disciplinary collaboration to maintain best practice medical procedures
- Appropriate and timely documentation of care
- Excellent management of schedule and caseload, including scheduling, maintaining proper orders from physician and navigation for timely delivery of services

Harvard Partners Health (Sep 2016 – May 2018) · 1 year 9 months
Physical Therapist
- Timely treatment of Geriatric population in various regions surrounding Seattle Metro in home health setting
- Development of Plan of Care and supervision of PTAs follow through with treatment expectations
- Clinical collaboration with various disciplines to meet complete care needs of clients

ATI Physical Therapy (Sep 2015 – Sep 2016) · 1 year 1 month
Physical Therapist
- Treated patients from diverse medical conditions including but not limited to Motor vehicle accidents, Orthopedic joint replacements and chronic pain injuries
- Supervising multiple PTAs carrying out Plan of Care with clients
- Maintained Schedule and productivity requirements
- Participated in In house training and continuing education

CLINICAL ROTATIONS (2013-2015):
- Lifecare Center of Haltom (Mar 2015 – Jun 2015) · 4 months: Skilled nursing facility with emphasis on lymphedema management through manual lymph drainage techniques, compression therapy, modalities and exercise intervention
- Sportherapy (Jan 2015 – Mar 2015) · 3 months: Outpatient clinic with business administration tasks, conflict resolution, billing, resource management, inventory assessment
- Healthlink (Oct 2014 – Dec 2014) · 3 months: Outpatient clinic performing initial evaluations, establishing physical therapy diagnosis, prognosis, and plan of care
- CHI St. Luke's Health Memorial Lufkin (Aug 2013 – Oct 2013) · 3 months: Hospital/acute care with emphasis on stroke/cardiac rehabilitation, ICU/critical care patient load
- Christus St. John Hospital (Mar 2011 – Jul 2012) · 1 year 5 months: Physical Therapist Technician working under supervision of licensed physical therapists, gained wound care experience

EDUCATION:
- University of Texas Medical Branch (Galveston, TX): Doctor of Physical Therapy (Aug 2012 – Aug 2015)

TECHNICAL PROJECTS:

AI-Powered Portfolio Chatbot
- Developed an intelligent AI chatbot integrated into his portfolio website using OpenAI GPT-3.5-turbo API
- Implemented cost-effective architecture with fallback responses and strict spending limits ($4 lifetime budget)
- Built with React frontend, Node.js/Express backend, deployed on Railway with comprehensive usage tracking
- Features include smart conversation flow, 40+ trigger phrases for detailed responses, and bulletproof cost protection
- Demonstrates full-stack development skills, API integration, and modern deployment practices

Ad Skipping Browser Extension for YouTube
- Engineered a forked Chrome extension using JavaScript and the Chrome Extensions API to speed up in-video ads to 15× and toggle playback between 1×/2×/3× via a single (Alt) key
- Published the extension to the Chrome Web Store, achieving over 6000+ impressions and 21 active users

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

RESPONSE GUIDELINES:
- Only use the information provided above
- If asked about something not mentioned, say "I don't have specific information about that" rather than guessing
- Be accurate and factual about dates, companies, and achievements
- If unsure about details, refer to the provided information only
- Be helpful, professional, and enthusiastic about Lance's work
- Keep responses informative and engaging while staying within the provided facts`;

// Fallback responses when OpenAI is not available
const FALLBACK_RESPONSES = {
  skills:
    "Lance Hebert has expertise in:\n\nLanguages: JavaScript, Ruby\nFrameworks: Ruby on Rails, React, HTML5, CSS3, Bootstrap\nDatabase Management: PostgreSQL, SQLite\nCMS & APIs: Contentful (Headless CMS), REST\nPerformance & Accessibility: Lighthouse, WCAG 2.1 AA\nTesting & Workflow: Git, Postman\nDeployment & Cloud: Heroku, Netlify, Railway, AWS S3, CloudFront\nTools: Foundation CSS, Bootstrap\n\nWhat specific skills would you like to know more about?",
  experience:
    "Lance Hebert has extensive professional experience:\n\nVOGLIO Marketing (2022-2025)\n- Web Developer II (May-Jul 2025): WCAG 2.1 AA accessibility expert, Contentful CMS workflows, mentored 2 developers, improved PageSpeed scores by 40 points\n- Web Developer (Aug 2022-May 2025): Built custom websites for $700M+ revenue clients, A/B testing, cross-functional collaboration, technical support\n\nHealthcare Background (2015-2020)\n- Physical Therapist at multiple healthcare organizations including Assured Home Healthcare, Signature Healthcare, Harvard Partners Health, ATI Physical Therapy\n- Extensive experience in home health, geriatric care, clinical management, and multi-disciplinary collaboration\n- Doctor of Physical Therapy from University of Texas Medical Branch (2012-2015)\n\nEducation: Flatiron School Software Engineer Certification (2021-2022)\n\nWhat would you like to know about his experience?",
  projects:
    "Lance Hebert has worked on several projects:\n\nAI-Powered Portfolio Chatbot (Current)\n- Built an intelligent chatbot using OpenAI GPT-3.5-turbo\n- Implemented cost-effective architecture with Railway deployment\n- Features anti-hallucination measures and usage tracking\n- Personalized to Lance's professional information\n\nAd Skipping Browser Extension for YouTube\n- Engineered Chrome extension using JavaScript and Chrome Extensions API\n- Published to Chrome Web Store with over 6000+ impressions and 21 active users\n- Features 15× ad speed-up and playback controls\n\nBootcamp Projects:\n- Physical Therapy Exercise Injury Prevention App: Ruby/PostgreSQL with charts and responsive design\n- Dungeons and Dragons Character Builder: React with authentication and randomization\n- Podcast Recommending App: Spotify API integration with React Bootstrap\n\nWhat project would you like to learn more about?",
  contact:
    "You can connect with Lance through:\n\n- Email: LSUHEBERT@gmail.com\n- Phone: 281-703-1477\n- LinkedIn: linkedin.com/in/Lance-Hebert\n- GitHub: github.com/lancehebert\n- Website: www.lance-hebert.com\n\nHe's always excited to discuss new opportunities!",
  default:
    "Hi! I'm ChadGPT, Lance's AI assistant. I can help you learn about his professional background! You can ask me about:\n\n- Experience & Work History\n- Technical Skills & Technologies\n- Projects & Portfolio\n- Contact Information\n- Education & Background\n- Interests & Passions (including gaming, fitness, and ice hockey)\n\nWhat would you like to know about Lance?",
  limitReached:
    "I'm currently experiencing high usage and need to conserve resources. I can still help you with information about Lance using my built-in knowledge! You can ask me about:\n\n- Experience & Work History\n- Technical Skills & Technologies\n- Projects & Portfolio\n- Contact Information\n- Education & Background\n- Interests & Passions (including gaming, fitness, and ice hockey)\n\nWhat would you like to know about Lance?",
  noInfo:
    "I don't have specific information about that topic in my knowledge base. I can help you with information about Lance's:\n\n- Experience & Work History\n- Technical Skills & Technologies\n- Projects & Portfolio\n- Contact Information\n- Education & Background\n- Interests & Passions (including gaming, fitness, and ice hockey)\n\nWhat would you like to know about Lance?",
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
        temperature: 0.3, // Lower temperature for more conservative responses
        top_p: 0.9, // Slightly more focused sampling
        frequency_penalty: 0.1, // Reduce repetition
        presence_penalty: 0.1, // Encourage staying on topic
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
    logger.error("OpenAI API error:", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    services: {
      openai: OPENAI_API_KEY ? "configured" : "not configured",
      railway: "operational",
      usage: {
        daily: usageStats.dailyRequests,
        monthly: usageStats.monthlyRequests,
        lifetimeSpend: usageStats.lifetimeSpend,
        openaiDisabled: usageStats.openaiDisabled,
      },
    },
  });
});

// Chat endpoint with input validation
app.post(
  "/api/chat",
  [
    body("message")
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Message must be between 1 and 1000 characters")
      .escape()
      .withMessage("Message contains invalid characters"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn("Validation error in chat endpoint", {
          errors: errors.array(),
        });
        return res.status(400).json({
          error: "Invalid input",
          details: errors.array(),
        });
      }

      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      let response;
      let note = "";
      const lowerMessage = message.toLowerCase();

      // Check if we've hit the $4 limit and should use fallback mode
      const useFallbackMode =
        usageStats.lifetimeSpend >= USAGE_LIMITS.LIFETIME_SPEND_LIMIT ||
        usageStats.openaiDisabled;

      if (!useFallbackMode && OPENAI_API_KEY && canMakeOpenAIRequest()) {
        // Use OpenAI by default until we hit the $4 limit
        try {
          const openaiResponse = await callOpenAI(message);
          response = openaiResponse;
          note = "Using OpenAI GPT-3.5-turbo (default mode)";
        } catch (openaiError) {
          logger.error("OpenAI failed, using fallback", {
            error: openaiError.message,
          });

          if (openaiError.message === "Usage limit reached") {
            // Use fallback responses when limits are hit
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
            response +=
              "\n\nI'm currently at my usage limit, but I can still help with the information above! Feel free to ask specific questions about Lance's background.";
            note = "Using fallback response (usage limit reached)";
          } else {
            // Use fallback responses for other errors
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
            response +=
              "\n\nI'm having trouble accessing my detailed response system, but I can still help with the information above!";
            note = "Using fallback response (OpenAI failed)";
          }
        }
      } else {
        // Fallback mode - use the current intelligent system
        // Check if user is asking for more detailed help or clarification
        const needsOpenAI =
          lowerMessage.includes("more detail") ||
          lowerMessage.includes("explain more") ||
          lowerMessage.includes("tell me more") ||
          lowerMessage.includes("elaborate") ||
          lowerMessage.includes("specific") ||
          lowerMessage.includes("detailed") ||
          lowerMessage.includes("in depth") ||
          lowerMessage.includes("thorough") ||
          lowerMessage.includes("comprehensive");

        // Use fallback responses based on message content
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
        if (!needsOpenAI) {
          response +=
            "\n\nDid that answer your question, or would you like me to investigate further with more detailed information?";
          note = "Using fallback response (default mode)";
        } else {
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
              logger.error("OpenAI failed, keeping fallback", {
                error: openaiError.message,
              });

              if (openaiError.message === "Usage limit reached") {
                response +=
                  "\n\nI'm currently at my usage limit, but I can still help with the information above! Feel free to ask specific questions about Lance's background.";
                note = "Using fallback response (usage limit reached)";
              } else {
                response +=
                  "\n\nI'm having trouble accessing my detailed response system, but I can still help with the information above!";
                note = "Using fallback response (OpenAI failed)";
              }
            }
          } else {
            // No OpenAI, limits reached, or lifetime limit exceeded
            if (usageStats.openaiDisabled) {
              response +=
                "\n\nI've reached my lifetime usage limit and can no longer provide detailed AI responses. However, I can still help with the information above! Feel free to ask specific questions about Lance's background.";
              note = "Using fallback response (lifetime spend limit reached)";
            } else if (!OPENAI_API_KEY) {
              response +=
                "\n\nI'm currently conserving resources, but I can still help with the information above! Feel free to ask specific questions about Lance's background.";
              note = "Using fallback response (OpenAI not configured)";
            } else {
              response +=
                "\n\nI'm currently at my usage limit, but I can still help with the information above! Feel free to ask specific questions about Lance's background.";
              note = "Using fallback response (usage limit reached)";
            }
          }
        }
      }

      res.json({
        success: true,
        response: response,
        timestamp: new Date().toISOString(),
        note: note,
      });
    } catch (error) {
      logger.error("Error in chat endpoint", {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "An unexpected error occurred. Please try again later.",
      });
    }
  }
);

// Export app for testing
module.exports = app;

// Start server only if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`🚀 Portfolio AI Backend running on port ${PORT}`);
    logger.info(`📡 Health check: http://localhost:${PORT}/health`);
    logger.info(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
    logger.info(`🤖 OpenAI configured: ${OPENAI_API_KEY ? "Yes" : "No"}`);
    logger.info(
      `💰 Usage limits: ${USAGE_LIMITS.DAILY_REQUESTS} daily, ${USAGE_LIMITS.MONTHLY_REQUESTS} monthly, $${USAGE_LIMITS.MAX_MONTHLY_COST} max cost, $${USAGE_LIMITS.LIFETIME_SPEND_LIMIT} lifetime spend limit`
    );
  });
}
