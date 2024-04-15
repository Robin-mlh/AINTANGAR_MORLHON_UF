document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault()
    let username = document.getElementById('username').value
    let password = document.getElementById('password').value
    fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: username, password: password }),
        }).then(response => response.json())
        .then(data => {
            if (data.token != null) {
                localStorage.setItem('token', data.token)
                window.location.href = '/'
            } else {
                alert("Nom d'utilisateur ou mot de passe invalide.")
            }
        })
    })