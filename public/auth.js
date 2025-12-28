const registerForm = document.querySelector(".form");
const result = document.getElementById("result");

const loginForm = document.getElementById("loginForm");
const loginResult = document.getElementById("login-result");

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const password = document.getElementById("password").value;
    const captchaInput = document.getElementById("captcha-input").value.trim();

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                firstName,
                lastName,
                password,
                captcha: captchaInput
            })
        });

        const text = await res.text();

        result.textContent = text;
        result.style.color = res.ok ? "green" : "red";

        if (res.ok) {
            registerForm.reset();
            setTimeout(() => {
                window.location.href = "/dashboard.html";
            }, 1000);
        } else {
            document.getElementById('captcha-img').click();
            document.getElementById('captcha-input').value = '';
        }

    } catch (error) {
        result.textContent = "Server error";
        result.style.color = "red";
    }
});


loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const text = await res.text();

        loginResult.textContent = text;
        loginResult.style.color = res.ok ? "green" : "red";

        if (res.ok) {
            loginForm.reset();

            setTimeout(() => {
                window.location.href = "/dashboard.html";
            }, 1000);
        }
    } catch (error) {
        loginResult.textContent = "Server error";
        loginResult.style.color = "red";
    }
})