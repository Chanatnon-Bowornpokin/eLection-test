const voteButton = document.getElementById('vote');
const resultsButton = document.getElementById('results');

if (voteButton) {
	voteButton.addEventListener('click', () => {
		window.location.href = 'pages/Vote-Check.html';
	});
}

if (resultsButton) {
	resultsButton.addEventListener('click', () => {
		window.location.href = 'pages/Vote-Result.html';
	});
}
