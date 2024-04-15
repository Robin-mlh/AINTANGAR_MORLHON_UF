document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('signupForm').addEventListener('submit', function (event) {
        event.preventDefault()
        let username = document.getElementById('username').value
        let password = document.getElementById('password').value
        
        fetch('/signup', {
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
                  alert("Nom d'utilisateur déjà existant.")
              }
          });
    });
});
