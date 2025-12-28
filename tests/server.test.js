const { requestHandler } = require("../src/server");
const utils = require("../src/utils");

const mockExecute = jest.fn();

jest.mock("../src/db", () => {
    return async () => ({
        execute: mockExecute
    });
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
            email: "test@mail.com",
            firstName: "Unit",
            lastName: "Test",
            password: "password123",
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
        const body = { captcha: "WRONG", email: "a@b.c" };
        const cookies = { captcha_token: "valid-token" };

        const { req, res } = createMockReqRes("POST", "/register", body, cookies);

        mockExecute.mockResolvedValueOnce([[{ code: "RIGHT" }]]);

        await requestHandler(req, res);
        if (req.promise) await req.promise;

        expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Wrong Captcha Code"));
    });

    test("POST /login logs user in", async () => {
        const body = { email: "user@mail.com", password: "pass" };
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
        const body = { email: "user@mail.com", password: "WRONG_PASS" };
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
});