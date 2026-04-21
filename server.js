import express from 'express';
import twilio from 'twilio';
import dotenv from 'dotenv';
import fs from 'fs'; // Required to read your JSON file

dotenv.config();
const app = express();
app.use(express.urlencoded({ extended: false }));

const { VoiceResponse } = twilio.twiml;

// 1. Helper function to get wallet data
const getWallet = (phoneNumber) => {
    // Read the file every time or cache it - reading for hackathon simplicity
    const data = JSON.parse(fs.readFileSync('./wallets.json', 'utf8'));

    // Clean the phone number (remove '+' if Twilio sends it)
    const cleanPhone = phoneNumber.replace('+', '');

    return data[cleanPhone] || null;
};

app.post('/voice/gateway', (req, res) => {
    const twiml = new VoiceResponse();
    const senderPhone = req.body.From;

    // Check if the SENDER exists in our wallets.json
    const senderWallet = getWallet(senderPhone);

    if (!senderWallet) {
        console.log(`❌ Unregistered caller: ${senderPhone}`);
        twiml.say("Your phone number is not linked to a Stark Zap wallet. Please register on WhatsApp.");
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
    }

    const gather = twiml.gather({
        action: '/voice/process-tx',
        input: 'dtmf',
        timeout: 10,
        finishOnKey: '' 
    });

    gather.play({ digits: 'w' }); 
    res.type('text/xml').send(twiml.toString());
});

app.post('/voice/process-tx', async (req, res) => {
    const digits = req.body.Digits; 
    const senderPhone = req.body.From;
    const twiml = new VoiceResponse();

    if (digits && digits.includes('*')) {
        const [amount, recipientPhone] = digits.split('*');

        // Lookup sender and recipient
        const sender = getWallet(senderPhone);
        const recipient = getWallet(recipientPhone);

        if (!recipient) {
            twiml.say("Recipient not found in our records.");
            console.log(`❌ Recipient ${recipientPhone} not found.`);
        } else {
            console.log(`💸 TRANSFER: ${amount} STRK`);
            console.log(`FROM: ${sender.address}`);
            console.log(`TO: ${recipient.address}`);

            twiml.say(`Sending ${amount} tokens to the registered wallet. Transaction initiated.`);

            // --- YOUR STARKNET LOGIC HERE ---
            // Use sender.encryptedKey and recipient.address
            // await starknetTx(sender, recipient.address, amount);
        }
    } else {
        twiml.say("No command detected.");
    }

    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
});

app.listen(3000, () => console.log("🔥 StarkZap Gateway with Wallet Lookup Active"));