# Portfolio AI Backend

Backend API for Lance Hebert's portfolio AI chatbot, providing intelligent responses about his professional background, skills, and experience.

## Features

- **AI-Powered Chat**: OpenAI GPT-3.5-turbo integration with fallback responses
- **Cost Control**: Sophisticated usage tracking and spending limits ($4 lifetime limit)
- **Anti-Hallucination**: Strict context adherence and parameter tuning
- **Performance Monitoring**: Health check endpoint with usage statistics
- **Railway Deployment**: Production-ready cloud deployment

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and usage statistics.

### Chat
```
POST /api/chat
Content-Type: application/json

{
  "message": "What are Lance's skills?"
}
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: Server port (default: 3001)

## Usage Limits

- **Daily Requests**: 50
- **Monthly Requests**: 1000
- **Lifetime Spend**: $4.00 (OpenAI disabled after limit)
- **Max Tokens per Request**: 500

## Deployment

Deployed on Railway at: `https://portfolio-ai-backend-production-1fa0.up.railway.app`

## Development

```bash
npm install
npm run dev  # Development with nodemon
npm start    # Production
```

## License

MIT License

