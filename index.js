import express from "express";
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from "path";
import { fileURLToPath } from 'url';

import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "./public/views/"));

const transactions = {};
const authenticatedKey = "AUTHENTICATED";
const authServerUrl = "https://21cc-122-187-103-118.ngrok.io";

app.get("/", (req, res) => {

    const nonce = uuidv4();
    const transactionToken = uuidv4();
    transactions[nonce] = {
        status: "unauthorized",
        transactionToken
    };

    console.log(`QR login request processed with nonce: ${nonce} and transactionToken: ${transactionToken}`);

    QRCode.toDataURL(`${authServerUrl}/auth/qr/authorize/${nonce}`)
        .then(data => res.render("login", {
            qrData: data,
            nonce
        }))
        .catch(err => {
            res.status(500).json({
                error: "Internal server error",
                error_description: "Error while generating QR"
            });

            console.log("Error while generating QR: ", err);
        });
});

app.post("/", (req, res) => {
    console.log(req.body);
    res.render("login-success");
});

app.get("/auth/qr/authorize/:nonce", (req, res) => {
    const { nonce } = req.params;
    res.render("authorize", {
        nonce
    });
});


app.post("/auth/qr/authorize", (req, res) => {

    const { username, password, nonce } = req.body;

    console.log(req.body);

    if (username === "admin" && password === "password" && transactions[nonce]) {
        transactions[nonce].status = authenticatedKey;
        return res.render("authorized");
    }

    res.status(400).json({
        "error": "Bad_Request"
    });

});

//Return status of authorization to the corresponding nonce
app.get("/auth/qr/status/:nonce", (req, res) => {

    const { nonce } = req.params;
    const transaction = transactions[nonce];

    if (!transaction) {
        return res.status(400).json({
            error: "Bad request",
            error_description: "Invalid nonce value or no transactions found"
        });
    }
    if (transaction.status === authenticatedKey) {
        return res.status(200).json({
            status: "authorized",
            transactionToken: transaction.transactionToken
        });
    }
    return res.status(200).json({
        error: "Authorization pending",
        error_description: "The authorization request is still pending as the end-user hasn't yet been authenticated."
    });
});

app.listen(port, () => console.log(`Server started at port: ${port}`));