require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// ১. ফেসবুক ওয়েবহুক ভেরিফিকেশন (GET Request)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook Verified Successfully!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ২. কমেন্ট ও ইনবক্স মেসেজ রিসিভ ও অটো-রিপ্লাই করার এন্ডপয়েন্ট (POST Request)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(async (entry) => {
      const webhookEvent = entry.messaging ? entry.messaging[0] : null;

      if (webhookEvent && webhookEvent.message && webhookEvent.message.text) {
        const senderPsid = webhookEvent.sender.id;
        const userMessage = webhookEvent.message.text.toLowerCase().trim();

        console.log(`Received Message from ${senderPsid}: ${userMessage}`);

        // বটের কাস্টম রিপ্লাই লজিক
        let replyText = "ধন্যবাদ মেসেজ দেওয়ার জন্য! আমরা কীভাবে সাহায্য করতে পারি?";

        if (userMessage.includes("হাই") || userMessage.includes("hello") || userMessage.includes("hi")) {
          replyText = "হ্যালো! আমাদের পেজে আপনাকে স্বাগতম।";
        } else if (userMessage.includes("দাম") || userMessage.includes("price")) {
          replyText = "আমাদের পণ্যের বিস্তারিত তথ্য জানতে পেজের শপ ভিজিট করুন বা আপনার কাঙ্ক্ষিত প্রোডাক্টটির নাম লিখুন।";
        }

        // রিপ্লাই সেন্ড করা
        await sendMessage(senderPsid, replyText);
      }
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// ৩. ফেসবুক সেন্ড এপিআই (Send API) ফাংশন
async function sendMessage(senderPsid, responseText) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: senderPsid },
        message: { text: responseText }
      }
    );
    console.log("Auto-reply sent successfully!");
  } catch (error) {
    console.error("Error sending message:", error.response ? error.response.data : error.message);
  }
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));0

