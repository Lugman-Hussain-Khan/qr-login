import express from "express";
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

const app = express();

app.use(express.json());
app.set("view engine", "ejs");

const transactions = {};
const authenticatedKey = "AUTHENTICATED";
const authServerUrl = "http://localhost:3000";

app.get("/auth/qr", (req, res) => {

    const nonce = uuidv4();
    QRCode.toDataURL(`${authServerUrl}/auth/qr/${nonce}`)
        .then(data => res.render("qr-login", {
            loginUrl: data,
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


app.post("/login/:nonce", (req, res) => {
    const { username, password } = req.body;
    const { nonce } = req.params;

    if (username === "admin" && password === "password") {
        transactions[nonce] = authenticatedKey;
    }

    res.status(200).json({
        "message": "Login authorized"
    });
});

//Return status of authorization to the corresponding nonce
app.get("/auth/qr/status/:nonce", (req, res) => {

    const { nonce } = req.params;
    const transactionStatus = transactions[nonce];

    if (!transactionStatus) {
        return res.status(400).json({
            error: "Bad request",
            error_description: "Invalid nonce value or no transactions found"
        });
    }

    if (transactionStatus === authenticatedKey) {
        return res.status(200).json({
            message: "authenticated"
        });
    }

    return res.status(200).json({
        error: "Authorization pending",
        error_description: "The authorization request is still pending as the end-user hasn't yet been authenticated."
    });

});

app.listen(3001, () => console.log("Server started at port: 3001"));