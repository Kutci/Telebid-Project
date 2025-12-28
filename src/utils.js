const crypto = require("crypto");

module.exports = {
    isValidEmail: function (email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    isValidName: function (name) {
        return typeof name === "string" && name.trim().length >= 2;
    },

    isValidPassword: function (password) {
        return typeof password === "string" && password.length >= 6;
    },

    hashPassword: function (password) {
        return crypto.createHash("sha256").update(password).digest("hex");
    },

    generateSessionId: function () {
        return crypto.randomBytes(16).toString("hex");
    },

    generateRandomCode: function (length = 6) {
        return crypto.randomBytes(length).toString("hex").substring(0, length).toUpperCase();
    },

    parseCookies: function (request) {
        const list = {};
        const cookieHeader = request.headers.cookie;
        if (!cookieHeader) return list;

        cookieHeader.split(";").forEach(cookie => {
            const parts = cookie.split("=");
            list[parts.shift().trim()] = decodeURI(parts.join("="));
        });

        return list;
    },

    generateCaptcha: function () {
        const width = 150;
        const height = 50;
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const length = 5;

        let code = "";
        let svgContent = "";

        const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const randomColor = (min = 50, max = 150) => `rgb(${randomInt(min, max)}, ${randomInt(min, max)}, ${randomInt(min, max)})`;

        for (let i = 0; i < 7; i++) {
            svgContent += `<line x1="${randomInt(0, width)}" y1="${randomInt(0, height)}" x2="${randomInt(0, width)}" y2="${randomInt(0, height)}" stroke="${randomColor(150, 220)}" stroke-width="${randomInt(1, 2)}" />`;
        }

        for (let i = 0; i < length; i++) {
            const char = chars.charAt(randomInt(0, chars.length - 1));
            code += char;

            const x = 20 + (i * 25);
            const y = randomInt(30, 40);
            const rotate = randomInt(-20, 20);

            svgContent += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${randomInt(24, 30)}" fill="${randomColor(0, 100)}" transform="rotate(${rotate}, ${x}, ${y})">${char}</text>`;
        }

        const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background-color: #f0f0f0; border-radius: 5px;">
            ${svgContent}
        </svg>
    `;

        return { svg, code };
    }
};
