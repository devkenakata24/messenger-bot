const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// -------------------- CONFIGURATION --------------------
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// তোমার Google Sheet-এর ID
const GOOGLE_SHEET_ID = '175DEroJl9xlgzh6mfa_aIH2HcqH04uxHgYVPO4DGNFg'; 
// --------------------------------------------------------

// Google Sheet থেকে ডাটা আনার ফাংশন
async function getProductsFromSheet() {
  try {
    const url = `https://opensheet.elk.sh/${GOOGLE_SHEET_ID}/1`;
    const response = await axios.get(url);
    return response.data; // Array of products
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error.message);
    return [];
  }
}

// Webhook Verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Webhook Event Handler (POST)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const webhook_event = entry.messaging ? entry.messaging[0] : null;

      if (webhook_event && webhook_event.message && !webhook_event.message.is_echo) {
        const senderPsid = webhook_event.sender.id;
        const userMessage = webhook_event.message.text ? webhook_event.message.text.toLowerCase() : '';

        console.log(`Received message from ${senderPsid}: ${userMessage}`);

        // গুগল শিট থেকে সাম্প্রতিক প্রোডাক্ট তালিকা আনা
        const products = await getProductsFromSheet();
        let replyMessage = '';

        // কি-ওয়ার্ড দিয়ে শিটে অনুসন্ধান করা
        for (const product of products) {
          if (product.keyword && userMessage.includes(product.keyword.toLowerCase())) {
            replyMessage = `🌸 ${product.name}\n\n💰 Price: ${product.price}\n\nঅর্ডার করতে চাইলে আপনার নাম, ঠিকানা ও মোবাইল নম্বরটি জানিয়ে দিন!`;
            break;
          }
        }

        // যদি কি-ওয়ার্ড না মেলে তবে ডিফল্ট রিপ্লাই
        if (!replyMessage) {
          if (userMessage.includes('hi') || userMessage.includes('hello') || userMessage.includes('সালাম')) {
            replyMessage = 'হ্যালো! আমাদের ট্রেন্ডি ওয়ার্ল্ড পেজে আপনাকে স্বাগতম। আপনি কোন প্রোডাক্টটি সম্পর্কে জানতে চান?';
          } else {
            replyMessage = 'ধন্যবাদ আপনার মেসেজের জন্য! আমাদের প্রতিনিধি খুব শীঘ্রই আপনার সাথে যোগ দেবেন। প্রোডাক্টের দাম জানতে সরাসরি প্রোডাক্টের নাম লিখে পাঠাতে পারেন।';
          }
        }

        // মেসেঞ্জারে উত্তর পাঠানো
        await callSendAPI(senderPsid, { text: replyMessage });
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Facebook Graph API call
async function callSendAPI(senderPsid, response) {
  const requestBody = {
    recipient: { id: senderPsid },
    message: response
  };

  try {
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, requestBody);
    console.log('Message sent successfully');
  } catch (err) {
    console.error('Unable to send message:', err.response ? err.response.data : err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
