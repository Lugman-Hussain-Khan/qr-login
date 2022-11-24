import express from "express";
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const host = process.env.HOST;

//Handle request body
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

//Fix for using __dirname with {type: "module"}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "./public/views/"));

const transactions = {};
const authenticatedKey = "AUTHENTICATED";

//Generate QR, transactionToken and render
app.get("/", (req, res) => {
    const nonce = uuidv4();
    const transactionToken = uuidv4();
    transactions[nonce] = {
        status: "unauthorized",
        transactionToken,
        expiry: new Date(new Date().getTime() + 2 * 60000).getTime()
    };
    QRCode.toDataURL(`${host}/auth/qr/authorize/${nonce}`)
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

//Validate transactionToken and render success
app.post("/", (req, res) => {
    const { nonce, transactionToken } = req.body;
    const transaction = transactions[nonce];
    if (!transaction || !transaction.token === transactionToken) {
        return res.status(400).json({
            error: "Bad request",
            error_description: "Invalid nonce or transaction token"
        });
    }
    delete transactions[nonce];
    res.render("login-success");
});

//Render authorization page
app.get("/auth/qr/authorize/:nonce", (req, res) => {
    const { nonce } = req.params;
    res.render("authorize", {
        nonce
    });
});

//Validate username & password, mutate transaction
app.post("/auth/qr/authorize", (req, res) => {
    const { username, password, nonce } = req.body;

    if (username !== "admin" && password !== "password") {
        return res.status(400).json({
            error: "Bad request",
            error_description: "Incorrect username or password"
        });
    }
    const transaction = transactions[nonce];
    if (!transaction || transaction.expiry < new Date().getTime()) {
        return res.status(400).json({
            error: "Bad request",
            error_description: "Invalid or expired nonce"
        });
    }
    transactions[nonce] = {
        ...transaction,
        status: authenticatedKey
    };
    console.log(transactions[nonce]);
    res.render("authorized");
});

//Return status of authorization to the corresponding nonce (Polled by the client)
app.get("/auth/qr/status/:nonce", (req, res) => {
    const { nonce } = req.params;
    const transaction = transactions[nonce];

    if (!transaction || transaction.expiry < new Date().getTime()) {
        return res.status(400).json({
            error: "Bad request",
            error_description: "Invalid or expired nonce"
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