const utils = require("../src/utils");

describe("Utils Functions", () => {

    test("isValidEmail should return true for valid emails", () => {
        expect(utils.isValidEmail("test@example.com")).toBe(true);
    });

    test("isValidEmail should return false for invalid emails", () => {
        expect(utils.isValidEmail("invalid-email")).toBe(false);
        expect(utils.isValidEmail("a@b")).toBe(false);
        expect(utils.isValidEmail("@domain.com")).toBe(false);
    });

    test("isValidName should return true for valid names", () => {
        expect(utils.isValidName("John")).toBe(true);
    });

    test("isValidName should return false for invalid names", () => {
        expect(utils.isValidName("")).toBe(false);
        expect(utils.isValidName(" ")).toBe(false);
        expect(utils.isValidName("A")).toBe(false);
        expect(utils.isValidName(123)).toBe(false);
    });

    test("isValidPassword should return true for valid passwords", () => {
        expect(utils.isValidPassword("123456")).toBe(true);
        expect(utils.isValidPassword("abcdef")).toBe(true);
    });

    test("isValidPassword should return false for short passwords", () => {
        expect(utils.isValidPassword("123")).toBe(false);
        expect(utils.isValidPassword("")).toBe(false);
    });

    test("hashPassword should return consistent hash", () => {
        const hash1 = utils.hashPassword("mypassword");
        const hash2 = utils.hashPassword("mypassword");
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64);
    });

    test("generateSessionId should return unique hex strings", () => {
        const id1 = utils.generateSessionId();
        const id2 = utils.generateSessionId();
        expect(typeof id1).toBe("string");
        expect(id1).not.toBe(id2);
        expect(id1).toHaveLength(32);
    });

    test("generateRandomCode should return string of requested length", () => {
        const code = utils.generateRandomCode(8);
        expect(typeof code).toBe("string");
        expect(code.length).toBe(8);
    });

    test("parseCookies should parse cookie header correctly", () => {
        const req = {
            headers: { cookie: "a=1; b=2; c=hello%20world" }
        };
        const parsed = utils.parseCookies(req);
        expect(parsed).toEqual({ a: "1", b: "2", c: "hello world" });
    });

    test("parseCookies should return empty object if no cookies", () => {
        const req = { headers: {} };
        const parsed = utils.parseCookies(req);
        expect(parsed).toEqual({});
    });

    test("generateCaptcha should return object with svg and code", () => {
        const captcha = utils.generateCaptcha();
        expect(captcha).toHaveProperty("svg");
        expect(captcha).toHaveProperty("code");
        expect(typeof captcha.code).toBe("string");
        expect(captcha.code.length).toBe(5);
        expect(captcha.svg).toContain("<svg");
    });

});
