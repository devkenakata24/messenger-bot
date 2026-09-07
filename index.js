const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// -------------------- CONFIGURATION --------------------
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Google Sheet ID
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
      
      // ------------ ১. মেসেঞ্জার চ্যাট হ্যান্ডলার ------------
      if (entry.messaging && Array.isArray(entry.messaging)) {
        for (const webhook_event of entry.messaging) {
          if (webhook_event.message && !webhook_event.message.is_echo) {
            const senderPsid = webhook_event.sender.id;
            const userMessage = webhook_event.message.text ? webhook_event.message.text.toLowerCase() : '';

            console.log(`Received message from ${senderPsid}: ${userMessage}`);

            const products = await getProductsFromSheet();
            let replyMessage = '';

            for (const product of products) {
              if (product.keyword) {
                const keywordsList = product.keyword.split(',').map(k => k.trim().toLowerCase());
                const isMatched = keywordsList.some(kw => userMessage.includes(kw));

                if (isMatched) {
                  replyMessage = `🌸 ${product.name}\n\n💰 Price: ${product.price}\n\nঅর্ডার করতে চাইলে আপনার নাম, ঠিকানা ও মোবাইল নম্বরটি জানিয়ে দিন!`;
                  break;
                }
              }
            }

            if (!replyMessage) {
              if (userMessage.includes('hi') || userMessage.includes('hello') || userMessage.includes('সালাম')) {
                replyMessage = 'হ্যালো! The Korean Mart bd-তে আপনাকে স্বাগতম। আপনি কোন প্রোডাক্টটি সম্পর্কে জানতে চান?';
              } else {
                replyMessage = 'ধন্যবাদ আপনার মেসেজের জন্য! আমাদের প্রতিনিধি খুব শীঘ্রই আপনার সাথে যোগাযোগ করবেন। প্রোডাক্টের তথ্য জানতে সরাসরি প্রোডাক্টের নাম লিখে পাঠাতে পারেন।';
              }
            }

            await callSendAPI(senderPsid, { text: replyMessage });
          }
        }
      }

      // ------------ ২. ফেসবুক পোস্ট কমেন্ট হ্যান্ডলার ------------
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          console.log("Change detected:", JSON.stringify(change));

          if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
            const commentId = change.value.comment_id;
            const commentText = change.value.message ? change.value.message.toLowerCase() : '';
            const senderName = change.value.from ? change.value.from.name : 'Customer';

            console.log(`New comment by ${senderName}: ${commentText}`);

            const products = await getProductsFromSheet();
            let matchedProduct = null;

            for (const product of products) {
              if (product.keyword) {
                const keywordsList = product.keyword.split(',').map(k => k.trim().toLowerCase());
                if (keywordsList.some(kw => commentText.includes(kw))) {
                  matchedProduct = product;
                  break;
                }
              }
            }

            let commentReply = '';
            if (matchedProduct) {
              commentReply = `ধন্যবাদ ${senderName}! ${matchedProduct.name}-এর দাম ${matchedProduct.price}। বিস্তারিত তথ্যের জন্য আমরা আপনাকে মেসেজ পাঠিয়েছি, ইনবক্স চেক করুন!`;
            } else {
              commentReply = `ধন্যবাদ ${senderName}! বিস্তারিত তথ্যের জন্য অনুগ্রহ করে আপনার ইনবক্স (Inbox) চেক করুন।`;
            }

            await replyToComment(commentId, commentReply);
          }
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Facebook Graph API - Send Message
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

// Facebook Graph API - Reply to Comment
async function replyToComment(commentId, message) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${commentId}/comments?access_token=${PAGE_ACCESS_TOKEN}`, {
      message: message
    });
    console.log('Comment replied successfully');
  } catch (err) {
    console.error('Unable to reply to comment:', err.response ? err.response.data : err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
