const voteButton = document.getElementById('vote');

if (voteButton) {
	voteButton.addEventListener('click', () => {
		window.location.href = 'pages/Vote-Check.html';
	});
}
