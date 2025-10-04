const form = document.getElementById("eventForm");
const messageDiv = document.getElementById("message");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usn = localStorage.getItem('usn');
    if (!usn) {
        window.location.href = 'index.html';
        return;
    }

    const formData = new FormData(form);
    formData.append('usn', usn);

    try {
        const res = await fetch("/events", {  // relative path
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            messageDiv.style.color = "green";
            messageDiv.textContent = "Event submitted successfully!";
            form.reset();
            // Redirect to dashboard after successful submission
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        } else {
            messageDiv.style.color = "red";
            messageDiv.textContent = data.error || "Failed to submit event";
        }
    } catch (err) {
        console.error(err);
        messageDiv.style.color = "red";
        messageDiv.textContent = "Error connecting to server";
    }
});
