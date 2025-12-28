require('dotenv').config();
const http = require("http");
const fs = require("fs");
const url = require("url");
const path = require("path");

const connectDB = require("./db");
const utils = require("./utils");


const requestHandler = async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const method = req.method;

    if (method === "GET") {

        if (parsedUrl.pathname === "/captcha") {
            const db = await connectDB();

            const { svg, code } = utils.generateCaptcha();

            const captchaToken = utils.generateSessionId();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

            await db.execute(
                `INSERT INTO captchas (token, code, expires_at) VALUES (?, ?, ?)`, [captchaToken, code, expiresAt]
            );

            await db.execute(`DELETE FROM captchas WHERE expires_at < NOW()`);

            res.writeHead(200, {
                "content-type": "image/svg+xml",
                "set-cookie": `captcha_token = ${captchaToken}; HttpOnly; Path=/; Max-Age = 300`,
                "cache-control": "no-store"
            });

            res.end(svg);
            return;
        }

        if (parsedUrl.pathname === "/dashboard.html") {
            const cookies = utils.parseCookies(req);
            const sessionId = cookies.session_id;

            if (!sessionId) {
                res.writeHead(302, { "location": "/" });
                res.end();
                return;
            }

            try {
                const db = await connectDB();

                const [rows] = await db.execute(
                    `SELECT * FROM sessions
                     WHERE session_id = ? AND expires_at > NOW()`, [sessionId]
                );

                if (rows.length === 0) {
                    res.writeHead(302, { "location": "/" });
                    res.end();
                    return;
                }
            } catch (error) {
                console.error("Auth error: ", error);
                res.writeHead(500, { "content-type": "text/plain" });
                res.end("Server error");
                return;
            }
        }



        if (parsedUrl.pathname === "/api/user") {
            const cookies = utils.parseCookies(req);
            const sessionId = cookies.session_id;

            if (!sessionId) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Unauthorized" }));
                return;
            }

            try {
                const db = await connectDB();
                const [rows] = await db.execute(
                    `SELECT u.first_name, u.last_name, u.email
                     FROM users u
                     JOIN sessions s ON u.id = s.user_id
                     WHERE s.session_id = ? AND s.expires_at > NOW()`, [sessionId]
                );

                if (rows.length === 0) {
                    res.writeHead(401, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Session expired" }));
                    return;
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(rows[0]));
            } catch (error) {
                console.error("API User Error:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Server error" }));
            }
            return;
        }


        if (parsedUrl.pathname === "/logout") {
            res.writeHead(302, { "location": "/", "set-cookie": "session_id=; HttpOnly; Path/=; Max-Age=0" });
            res.end();
            return;
        }


        if (parsedUrl.pathname === "/" || parsedUrl.pathname === "/index.html") {
            const cookies = utils.parseCookies(req);
            if (cookies.session_id) {
                try {
                    const db = await connectDB();

                    const [rows] = await db.execute(
                        `SELECT * FROM sessions
                         WHERE session_id = ? AND expires_at > NOW()`, [cookies.session_id]
                    );


                    if (rows.length > 0) {
                        res.writeHead(302, { "location": "/dashboard.html" });
                        res.end();
                        return;
                    }
                } catch (error) {
                    console.error("Auto-login failed: ", error);
                }
            }
        }



        let filePath = path.join(__dirname, "..", "public", req.url === "/" ? "index.html" : req.url);
        const extname = path.extname(filePath);
        let contentType = "text/html";

        switch (extname) {
            case ".js": contentType = "text/javascript"; break;
            case ".css": contentType = "text/css"; break;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === "ENOENT") {
                    res.writeHead(404, { "content-type": "text/plain" });
                    res.end("404 - FILE NOT FOUND!");
                } else {
                    console.error("FILE READ ERROR:", err);
                    res.writeHead(500, { "content-type": "text/plain" });
                    res.end(`Server error: ${err.code}`);
                }
            } else {
                res.writeHead(200, { "content-type": contentType });
                res.end(content, "utf-8");
            }
        });

    }
    if (method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const data = JSON.parse(body);
            const db = await connectDB();

            if (parsedUrl.pathname === "/register") {

                const cookies = utils.parseCookies(req);
                const captchaToken = cookies.captcha_token;

                if (!captchaToken || !data.captcha) {
                    res.writeHead(400, { "content-type": "text/plain" });
                    res.end("Please enter the captcha code");
                    return;
                }

                const [rows] = await db.execute(
                    `SELECT code FROM captchas WHERE token = ? AND expires_at > NOW()`,
                    [captchaToken]
                );

                if (rows.length === 0) {
                    res.writeHead(400, { "content-type": "text/plain" });
                    res.end("Captcha expired. Please refresh the image.");
                    return;
                }

                if (rows[0].code.toUpperCase() !== data.captcha.toUpperCase()) {
                    res.writeHead(400, { "content-type": "text/plain" });
                    res.end("Wrong Captcha Code");
                    return;
                }

                await db.execute(`DELETE FROM captchas WHERE token = ?`, [captchaToken]);


                if (!utils.isValidEmail(data.email)) {
                    res.writeHead(400, { "content-type": "text/plain" });
                    res.end("Invalid email");
                    return;
                }

                if (!utils.isValidName(data.firstName) || !utils.isValidName(data.lastName)) {
                    res.writeHead(400, { "content-type": "text/plain" });
                    res.end("First or last name is too short");
                    return;
                }

                if (!utils.isValidPassword(data.password)) {
                    res.writeHead(400, { "content-type": "text/plain" });
                    res.end("Password is too short");
                    return;
                }

                const hashed = utils.hashPassword(data.password);

                try {
                    const [result] = await db.execute(
                        `INSERT INTO users (email, first_name, last_name, password_hash)
                         VALUES(?, ?, ?, ?)`,
                        [data.email, data.firstName, data.lastName, hashed]
                    );

                    const userId = result.insertId;

                    const sessionId = utils.generateSessionId();
                    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

                    await db.execute(
                        `INSERT INTO sessions (session_id, user_id, expires_at)
                         VALUES (?, ?, ?)`, [sessionId, userId, expiresAt]
                    );


                    res.writeHead(200, {
                        "content-type": "text/plain",
                        "set-cookie": `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=${24 * 60 * 60}`
                    });
                    res.end("Successful Registration and Logged In");

                } catch (error) {
                    console.error("DB ERROR:", error);
                    res.writeHead(500, { "content-type": "text/plain" });
                    res.end("Error in registration");
                }

                return;
            }

            if (parsedUrl.pathname === "/login") {
                const [users] = await db.execute(
                    `SELECT id, password_hash FROM users WHERE email = ?`, [data.email]
                );

                if (users.length === 0) {
                    res.writeHead(401, { "content-type": "text/plain" });
                    res.end("Invalid email or password");
                    return;
                }

                const user = users[0];

                const inputHash = utils.hashPassword(data.password);

                if (inputHash !== user.password_hash) {
                    res.writeHead(401, { "content-type": "text/plain" });
                    res.end("Invalid password");
                    return;
                }

                const sessionId = utils.generateSessionId();
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

                try {
                    await db.execute(
                        `INSERT INTO sessions (session_id, user_id, expires_at)
                         VALUES (?, ?, ?)`, [sessionId, user.id, expiresAt]
                    );

                    res.writeHead(200, {
                        "content-type": "text/plain",
                        "set-cookie": `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=${24 * 60 * 60}`
                    });
                    res.end("Login Successful");
                } catch (error) {
                    console.error("Session DB Error", error);
                    res.writeHead(500, { "content-type": "text/plain" });
                    res.end("Server error during login");
                }

                return;
            }

            if (parsedUrl.pathname === "/api/update-profile") {
                const cookies = utils.parseCookies(req);
                if (!cookies.session_id) {
                    res.writeHead(401);
                    res.end("Unauthorized");
                    return;
                }

                try {
                    const [sessions] = await db.execute(
                        `SELECT user_id FROM sessions WHERE session_id = ? AND expires_at > NOW()`, [cookies.session_id]
                    );

                    if (sessions.length === 0) {
                        res.writeHead(401);
                        res.end("Session expired");
                        return;
                    }

                    const userId = sessions[0].user_id;

                    if (!utils.isValidName(data.firstName) || !utils.isValidName(data.lastName)) {
                        res.writeHead(400);
                        res.end("Invalid names");
                        return;
                    }

                    await db.execute(
                        `UPDATE users SET first_name = ?, last_name = ? WHERE id = ?`, [data.firstName, data.lastName, userId]
                    );

                    res.writeHead(200, { "content-type": "text/plain" });
                    res.end("Profile Updated Successfully");
                } catch (error) {
                    console.error("Update error occured: ", error);
                    res.writeHead(500, { "content-type": "text/plain" });
                    res.end("Database error");
                }
                return;
            }

            if (parsedUrl.pathname === "/api/update-password") {
                const cookies = utils.parseCookies(req);
                if (!cookies.session_id) {
                    res.writeHead(401, { "content-type": "text/plain" });
                    res.end("Unauthorized");
                    return;
                }

                try {
                    const [rows] = await db.execute(
                        `SELECT u.id, u.password_hash
                         FROM users u
                         JOIN sessions s ON u.id = s.user_id
                         WHERE s.session_id = ? AND s.expires_at > NOW()`, [cookies.session_id]
                    );

                    if (rows.length === 0) {
                        res.writeHead(401, { "content-type": "text/plain" });
                        res.end("Session expired");
                        return;
                    }

                    const user = rows[0];

                    const oldHash = utils.hashPassword(data.oldPassword);
                    if (oldHash !== user.password_hash) {
                        res.writeHead(401, { "content-type": "text/plain" });
                        res.end("Old password is incorrect");
                        return;
                    }

                    if (!utils.isValidPassword(data.newPassword)) {
                        res.writeHead(401, { "content-type": "text/plain" });
                        res.end("New password is too leak");
                        return;
                    }

                    const newHash = utils.hashPassword(data.newPassword);
                    await db.execute(
                        `UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, user.id]
                    );
                    res.writeHead(200, { "content-type": "text/plain" });
                    res.end("Password Changed Successfully");
                } catch (error) {
                    console.error("Update Password error: ", error);
                    res.writeHead(500, { "content-type": "text/plain" });
                    res.end("Database error");
                }

                return;
            }

        })
    }

}

const server = http.createServer(requestHandler);

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

module.exports = { server, requestHandler };
