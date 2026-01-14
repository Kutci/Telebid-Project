

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch("/api/user");
        if (res.ok) {
            const user = await res.json();

            document.getElementById("welcome-name").textContent = `${user.first_name} ${user.last_name}`;
            document.getElementById("update-firstname").value = user.first_name;
            document.getElementById("update-lastname").value = user.last_name;
        } else {
            window.location.href = "/";
        }

    } catch (error) {
        console.error("Error loading user data");
    }
});

const profileForm = document.getElementById("profile-form");
const profileResult = document.getElementById("profile-result");

profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = document.getElementById("update-firstname").value.trim();
    const lastName = document.getElementById("update-lastname").value.trim();

    try {
        const res = await fetch("/api/update-profile", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ firstName, lastName })
        });

        const data = await res.json();

        profileResult.textContent = data.message || data.error || "Something went wrong";
        profileResult.style.color = res.ok ? "green" : "red";

        if (res.ok) {
            document.getElementById("welcome-name").textContent = `${firstName} ${lastName}`;
        }

    } catch (error) {
        console.error("Error updating the user info: ", error);
    }
});

const passwordForm = document.getElementById("password-form");
const passwordResult = document.getElementById("password-result");

passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const oldPassword = document.getElementById("old-password").value;
    const newPassword = document.getElementById("new-password").value;

    try {
        const res = await fetch("/api/update-password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await res.json();

        passwordResult.textContent = data.message || data.error || "Something went wrong";
        passwordResult.style.color = res.ok ? "green" : "red";

        if (res.ok) {

        }
    } catch (error) {
        console.error("Error occured when changing password: ", error);
    }
})

