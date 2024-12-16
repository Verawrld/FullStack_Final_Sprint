// Establish a WebSocket connection to the server
const socket = new WebSocket("ws://localhost:3000/ws");

// Listen for messages from the server
socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "newPoll") {
    onNewPollAdded(data.poll);
  } else if (data.type === "voteUpdate") {
    onIncomingVote(data);
  }
});

/**
 * Handles adding a new poll to the page when one is received from the server
 *
 * @param {*} data The data from the server (ideally containing the new poll's ID and it's corresponding questions)
 */
function onNewPollAdded(poll) {
  const pollContainer = document.getElementById("polls");
  const newPoll = document.createElement("li");
  newPoll.className = "poll-container";
  newPoll.id = poll._id;
  newPoll.innerHTML = `
          <h2>${poll.question}</h2>
          <ul class="poll-options">
              ${poll.options
                .map(
                  (option) =>
                    `<li id="${poll._id}_${option.answer}"><strong>${option.answer}:</strong> ${option.votes} votes</li>`
                )
                .join("")}
          </ul>
          <form class="poll-form button-container">
              ${poll.options
                .map(
                  (option) =>
                    `<button class="action-button vote-button" type="submit" value="${option.answer}" name="poll-option">Vote for ${option.answer}</button>`
                )
                .join("")}
              <input type="text" style="display: none;" value="${
                poll._id
              }" name="poll-id"/>
          </form>
      `;
  pollContainer.appendChild(newPoll);
  newPoll.querySelectorAll(".poll-form").forEach((pollForm) => {
    pollForm.addEventListener("submit", onVoteClicked);
  });
}

/**
 * Handles updating the number of votes an option has when a new vote is recieved from the server
 *
 * @param {*} data The data from the server (probably containing which poll was updated and the new vote values for that poll)
 */
function onIncomingVote(data) {
  const { pollId, option, votes } = data;
  const optionElement = document.getElementById(`${pollId}_${option}`);
  if (optionElement) {
    optionElement.innerHTML = `<strong>${option}:</strong> ${votes} votes`;
  }
}

/**
 * Handles processing a user's vote when they click on an option to vote
 *
 * @param {FormDataEvent} event The form event sent after the user clicks a poll option to "submit" the form
 */
function onVoteClicked(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const pollId = formData.get("poll-id");
  const selectedOption = event.submitter.value;
  socket.send(JSON.stringify({ type: "vote", pollId, selectedOption }));
}

//Adds a listener to each existing poll to handle things when the user attempts to vote
document.querySelectorAll(".poll-form").forEach((pollForm) => {
  pollForm.addEventListener("submit", onVoteClicked);
});
