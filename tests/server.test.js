const { error } = require("console");
const { requestHandler } = require("../src/server");
const utils = require("../src/utils");
const fs = require("fs");
const mockExecute = jest.fn();


jest.mock("../src/db", () => {
    return async () => ({
        execute: mockExecute
    });
});

jest.mock("fs", () => {
    return {
        readFile: jest.fn(),
    };
});

function createMockReqRes(method, url, body = null, cookies = {}) {
    const req = {
        method,
        url,
        headers: {
            host: "localhost:3000",
            cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
        },
        on: (event, callback) => {
            if (event === "data" && body) callback(JSON.stringify(body));
            if (event === "end") {
                req.promise = callback();
            }
        }
    };

    const res = {
        writeHead: jest.fn(),
        end: jest.fn(),
    };

    return { req, res };
}

describe("Server Logic Unit Tests", () => {

    beforeEach(() => {
        mockExecute.mockClear();
        jest.clearAllMocks();
    });

    test("GET /captcha returns SVG and sets cookie", async () => {
        const { req, res } = createMockReqRes("GET", "/captcha");
        mockExecute.mockResolvedValue([{}]);

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
            "content-type": "image/svg+xml"
        }));
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("<svg"));
    });

    test("POST /register creates user successfully", async () => {
        const body = {
            email: "a@abv.bg",
            firstName: "Ogi",
            lastName: "Marinski",
            password: "123456",
            captcha: "CODE"
        };
        const cookies = { captcha_token: "valid-token" };

        const { req, res } = createMockReqRes("POST", "/register", body, cookies);

        mockExecute
            .mockResolvedValueOnce([[{ code: "CODE" }]])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{ insertId: 1 }])
            .mockResolvedValueOnce([{}]);
        await requestHandler(req, res);

        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Successful Registration"));
    });

    test("POST /register fails if captcha is wrong", async () => {
        const body = { captcha: "WRONG", email: "a@abv.bg" };
        const cookies = { captcha_token: "valid-token" };

        const { req, res } = createMockReqRes("POST", "/register", body, cookies);

        mockExecute.mockResolvedValueOnce([[{ code: "RIGHT" }]]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
        expect(res.end).toHaveBeenCalledWith("Wrong Captcha Code");
    });

    test("POST /login logs user in", async () => {
        const body = { email: "a@abv.bg", password: "pass" };
        const correctHash = utils.hashPassword("pass");

        const { req, res } = createMockReqRes("POST", "/login", body);

        mockExecute
            .mockResolvedValueOnce([[{ id: 1, password_hash: correctHash }]])
            .mockResolvedValueOnce([{}]);

        await requestHandler(req, res);

        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
        expect(res.end).toHaveBeenCalledWith("Login Successful");
    });

    test("POST /login fails with wrong password", async () => {
        const body = { email: "a@abv.bg", password: "WRONG_PASS" };
        const correctHash = utils.hashPassword("REAL_PASS");

        const { req, res } = createMockReqRes("POST", "/login", body);

        mockExecute.mockResolvedValueOnce([[{ id: 1, password_hash: correctHash }]]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything());
        expect(res.end).toHaveBeenCalledWith("Invalid password");
    });

    test("GET /dashboard.html redirects if no session", async () => {
        const { req, res } = createMockReqRes("GET", "/dashboard.html");

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
            "location": "/"
        }));
    });

    test("POST /api/update-password succeeds with correct old pass", async () => {
        const cookies = { session_id: "valid" };
        const body = { oldPassword: "oldPass", newPassword: "newPass" };

        const { req, res } = createMockReqRes("POST", "/api/update-password", body, cookies);

        const oldHash = utils.hashPassword("oldPass");

        mockExecute
            .mockResolvedValueOnce([[{ id: 1, password_hash: oldHash }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
        expect(res.end).toHaveBeenCalledWith("Password Changed Successfully");
    });

    test("POST /api/update-password fails with incorrect old pass", async () => {
        const cookies = { session_id: "valid" };
        const body = { oldPassword: "wrong", newPassword: "123456" };

        const { req, res } = createMockReqRes("POST", "/api/update-password", body, cookies);

        const correctHash = utils.hashPassword("correctPass");

        mockExecute.mockResolvedValueOnce([[{ id: 1, password_hash: correctHash }]]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything());
        expect(res.end).toHaveBeenCalledWith("Old password is incorrect");
    });

    test("GET /logout clears cookies and redirect", async () => {
        const { req, res } = createMockReqRes("GET", "/logout");

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
            "location": "/",
            "set-cookie": expect.stringContaining("Max-Age=0")
        }));
    });

    test("GET / redirects to dashboard if already logged", async () => {
        const cookies = { session_id: "valid" };
        const { req, res } = createMockReqRes("GET", "/", null, cookies);

        mockExecute.mockResolvedValueOnce([[{ session_id: "valid" }]]);

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
            "location": "/dashboard.html"
        }));
    });

    test("GET /api/user returns user data", async () => {
        const cookies = { session_id: "valid" };
        const { req, res } = createMockReqRes("GET", "/api/user", null, cookies);

        mockExecute.mockResolvedValueOnce([[{ firstName: "Ogi", lastName: "Marinski", email: "ogi@gmail.com" }]]);

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Ogi"));
    });

    test("GET /api/user fails without session", async () => {
        const { req, res } = createMockReqRes("GET", "/api/user");

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything());
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Unauthorized"));
    });

    test("POST /api/update-profile updates names successfully", async () => {
        const cookies = { session_id: "valid" };
        const body = { firstName: "Ogi", lastName: "Marinski" };

        const { req, res } = createMockReqRes("POST", "/api/update-profile", body, cookies);

        mockExecute
            .mockResolvedValueOnce([[{ user_id: 1 }]])
            .mockResolvedValueOnce([[{ affectedRows: 1 }]]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
        expect(res.end).toHaveBeenCalledWith("Profile Updated Successfully");
    });

    test("POST /api/update-profile fails with invalid names", async () => {
        const cookies = { session_id: "valid" };
        const body = { firstName: "O", lastName: "" };

        const { req, res } = createMockReqRes("POST", "/api/update-profile", body, cookies);

        mockExecute.mockResolvedValueOnce([[{ user_id: 1 }]]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
        expect(res.end).toHaveBeenCalledWith("Invalid names");
    });

    test("Serves index.html for root path", async () => {
        const { req, res } = createMockReqRes("GET", "/");

        fs.readFile.mockImplementation((path, cb) => cb(null, "<html>Index</html>"));

        await requestHandler(req, res);

        expect(fs.readFile).toHaveBeenCalled();
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
            "content-type": "text/html"
        }));
        expect(res.end).toHaveBeenCalledWith("<html>Index</html>", "utf-8");
    });

    test("Serves CSS files correctly", async () => {
        const { req, res } = createMockReqRes("GET", "/style.css");

        fs.readFile.mockImplementation((path, cb) => cb(null, "body {}"));

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
            "content-type": "text/css"
        }));
    });

    test("Serves JS files correctly", async () => {
        const { req, res } = createMockReqRes("GET", "/auth.js");

        fs.readFile.mockImplementation((path, cb) => cb(null, "body {}"));

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
            "content-type": "text/javascript"
        }));
    });

    test("Return 404 for missing files", async () => {
        const { req, res } = createMockReqRes("GET", "/missing.png");

        const error = new Error("Not found");
        error.code = "ENOENT";

        fs.readFile.mockImplementation((path, cb) => cb(error, null));

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
        expect(res.end).toHaveBeenCalledWith("404 - FILE NOT FOUND!");
    });

    test("GET /dashboard.html returns 500 if DB fails", async () => {
        const cookies = { session_id: "valid" };
        const { req, res } = createMockReqRes("GET", "/dashboard.html", null, cookies);

        mockExecute.mockRejectedValueOnce(new Error("Database Failure"));

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(500, expect.objectContaining({
            "content-type": "text/plain"
        }));

        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Server error"));

    });

    test("GET /api/user returns 500 on selection failure", async () => {
        const cookies = { session_id: "valid" };
        const { req, res } = createMockReqRes("GET", "/api/user", null, cookies);

        mockExecute.mockRejectedValueOnce(new Error("Select Failed"));

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(500, expect.anything());
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Server error"));
    });

    test("GET /api/user returns 401 when user is not found", async () => {
        const cookies = { session_id: "invalid" };
        const { req, res } = createMockReqRes("GET", "/api/user", null, cookies);

        mockExecute.mockResolvedValueOnce([[]]);

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(401, expect.objectContaining({
            "content-type": "application/json"
        }));
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Session expired"));
    })

    test("GET /dashboard.html redirects to / when session is not found", async () => {
        const cookies = { session_id: "invalid" };
        const { req, res } = createMockReqRes("GET", "/dashboard.html", null, cookies);

        mockExecute.mockResolvedValueOnce([[]]);

        await requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
            "location": "/"
        }));
        expect(res.end).toHaveBeenCalled();
    });

    test("POST /register fails if captcha token is missing", async () => {
        const body = { email: "a@abv.bg" };
        const { req, res } = createMockReqRes("POST", "/register", body);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
            "content-type": "text/plain"
        }));

        expect(res.end).toHaveBeenCalledWith("Please enter the captcha code");
    });

    test("POST /register fails if captcha is expired in db", async () => {
        const body = { captcha: "CODE", email: "a@abv.bg" };
        const cookies = { captcha_token: "expired" };

        const { req, res } = createMockReqRes("POST", "/register", body, cookies);

        mockExecute.mockResolvedValueOnce([[]]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
            "content-type": "text/plain"
        }));
        expect(res.end).toHaveBeenCalledWith("Captcha expired. Please refresh the image.");
    });

    test("POST /register fails with invalid email", async () => {
        const body = {
            email: "abv.bg",
            firstName: "Ogi",
            lastName: "Marinski",
            password: "123456",
            captcha: "CODE"
        };

        const cookies = { captcha_token: "valid" };

        const { req, res } = createMockReqRes("POST", "/register", body, cookies);

        mockExecute.mockResolvedValueOnce([[{ code: "CODE" }]]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
            "content-type": "text/plain"
        }));
        expect(res.end).toHaveBeenCalledWith("Invalid email");
    });


});