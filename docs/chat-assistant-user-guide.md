# Chat Assistant — User Documentation

## Quick Start

### Accessing the Chat

1. Log in to the BobSolar dashboard
2. Click the chat icon in the bottom-right corner
3. Type your message and press Enter

### Basic Usage

The chat assistant specializes in inverter fault code diagnostics. You can:

- **Ask about fault codes**: "What does F09 mean on a Growatt inverter?"
- **Describe symptoms**: "My inverter shows a red light and won't connect"
- **Follow up**: The assistant remembers your conversation context

### Example Conversations

```
User: What does fault code F09 mean?
Assistant: F09 on Growatt inverters indicates a DC bus overvoltage condition.
This can be caused by...

User: How do I fix it?
Assistant: For F09 (DC bus overvoltage), follow these steps:
1. Check the DC input voltage...
2. Verify the PV string configuration...
```

## Features

### Conversation History

- Conversations are automatically saved
- Access previous conversations from the sidebar
- Each conversation tracks the inverter brand and fault codes discussed

### Brand-Specific Diagnostics

Mention your inverter brand for targeted assistance:
- Growatt
- Sungrow
- Huawei
- Deye
- GoodWe
- Felicity
- Voltronic
- Must Power

### Session Management

- Sessions expire after 24 hours of inactivity
- Maximum 5 active sessions per user
- Conversations auto-archive after 500 messages

## Frequently Asked Questions

### General

**Q: What languages does the assistant support?**
A: The assistant responds in Burmese by default. You can request English responses.

**Q: Can the assistant diagnose all inverter brands?**
A: The assistant has knowledge of major inverter brands. If information is not available for a specific fault code, it will let you know and offer general diagnostic steps.

**Q: How accurate is the diagnostic information?**
A: The assistant uses a curated knowledge base of inverter documentation. Always verify critical diagnostics with official manufacturer documentation.

### Rate Limits and Quotas

**Q: Why am I getting "rate limit exceeded" errors?**
A: The system limits chat messages to 20 per minute per user. Wait a moment and try again.

**Q: What happens when I reach my daily token quota?**
A: You'll receive a message indicating the quota is exceeded. The quota resets at midnight.

**Q: How many tokens do I have left?**
A: Each response includes remaining quota information in the response headers.

### Troubleshooting

**Q: The chat isn't responding**
A: Check your internet connection. If the issue persists, try refreshing the page.

**Q: My conversation was lost**
A: Conversations are saved automatically. Check the conversation history sidebar. If a conversation is missing, it may have been auto-archived.

**Q: The assistant gave wrong information**
A: The assistant uses a knowledge base that may not cover all scenarios. Report incorrect responses to help improve the system.

### Security

**Q: Is my chat data private?**
A: Yes. Chat conversations are only accessible by you and system administrators.

**Q: Can other users see my conversations?**
A: No. Each user's conversations are isolated by their user ID.

**Q: How long is chat data retained?**
A: Chat messages are retained according to the system's data retention policy. Usage logs are kept for cost tracking and analytics.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Enter | Send message |
| Shift+Enter | New line |
| Escape | Close chat window |

## Tips for Best Results

1. **Be specific**: Include your inverter brand and exact fault code
2. **One question at a time**: Complex multi-part questions may be less accurate
3. **Provide context**: If following up, reference the previous discussion
4. **Use exact fault codes**: "F09" is more helpful than "error 9"

## Support

If you encounter issues not covered here:

1. Check the system status page
2. Contact your system administrator
3. Submit a support ticket with:
   - Your user ID
   - Time of the issue
   - Error message (if any)
   - Steps to reproduce
