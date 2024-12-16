const express = require("express");
const expressWs = require("express-ws");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");

const PORT = 3000;
const MONGO_URI = "mongodb://localhost:27017/keyin_test";
const app = express();
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(
  session({
    secret: "voting-app-secret",
    resave: false,
    saveUninitialized: false,
  })
);

//Note: Not all routes you need are present here, some are missing and you'll need to add them yourself.

let connectedClients = [];

app.ws("/ws", (socket, request) => {
  connectedClients.push(socket);

  socket.on("message", async (message) => {
    const data = JSON.parse(message);
    if (data.type === "vote") {
      const userId = request.session.user.id;
      const hasVoted = await Vote.findOne({ userId, pollId: data.pollId });
      if (!hasVoted) {
        try {
          await onNewVote(userId, data.pollId, data.selectedOption);
        } catch (error) {
          console.error(`Error processing vote: ${error.message}`);
          socket.send(
            JSON.stringify({
              type: "error",
              message: "An error occurred while processing your vote.",
            })
          );
        }
      } else {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "You have already voted on this poll.",
          })
        );
      }
    }
  });

  socket.on("close", () => {
    connectedClients = connectedClients.filter((client) => client !== socket);
  });
});

async function onNewVote(userId, pollId, selectedOption) {
  const poll = await Poll.findById(pollId);
  if (!poll) {
    console.error(`Poll with id ${pollId} not found`);
    return;
  }
  const option = poll.options.find((opt) => opt.answer === selectedOption);
  if (!option) {
    console.error(`Option ${selectedOption} not found in poll ${pollId}`);
    return;
  }
  option.votes += 1;
  await poll.save();
  const vote = new Vote({ userId, pollId, option: selectedOption });
  await vote.save();
  connectedClients.forEach((client) =>
    client.send(
      JSON.stringify({
        type: "voteUpdate",
        pollId,
        option: selectedOption,
        votes: option.votes,
      })
    )
  );
}

app.get("/", async (request, response) => {
  const pollCount = await Poll.countDocuments();
  if (request.session.user?.id) {
    return response.redirect("/dashboard");
  }
  response.render("index/unauthenticatedIndex", { pollCount });
});

app.get("/login", async (request, response) => {
  response.render("login", { errorMessage: null });
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const user = await User.findOne({ username });
  if (user && (await bcrypt.compare(password, user.password))) {
    request.session.user = { id: user._id, username: user.username };
    return response.redirect("/dashboard");
  }
  response.render("login", { errorMessage: "Invalid username or password" });
});

app.get("/signup", async (request, response) => {
  if (request.session.user?.id) {
    return response.redirect("/dashboard");
  }
  return response.render("signup", { errorMessage: null });
});

app.post("/signup", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });
  await user.save();
  request.session.user = { id: user._id, username: user.username };
  response.redirect("/dashboard");
});

app.get("/dashboard", async (request, response) => {
  if (!request.session.user?.id) {
    return response.redirect("/");
  }
  const polls = await Poll.find();
  return response.render("index/authenticatedIndex", {
    polls,
    user: request.session.user,
  });
});

app.get("/profile", async (request, response) => {
  if (!request.session.user?.id) {
    return response.redirect("/");
  }
  const user = await User.findById(request.session.user.id);
  const pollsVotedIn = await Vote.countDocuments({ userId: user._id });
  response.render("profile", { user, pollsVotedIn });
});

app.get("/createPoll", async (request, response) => {
  if (!request.session.user?.id) {
    return response.redirect("/");
  }
  return response.render("createPoll", { user: request.session.user });
});

// Poll creation
app.post("/createPoll", async (request, response) => {
  const { question, options } = request.body;
  const formattedOptions = Object.values(options).map((option) => ({
    answer: option,
    votes: 0,
  }));
  const poll = new Poll({ question, options: formattedOptions });
  await poll.save();
  connectedClients.forEach((client) =>
    client.send(JSON.stringify({ type: "newPoll", poll }))
  );
  response.redirect("/dashboard");
});

app.get("/logout", (request, response) => {
  request.session.destroy();
  response.redirect("/");
});

mongoose
  .connect(MONGO_URI)
  .then(() =>
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    )
  )
  .catch((err) => console.error("MongoDB connection error:", err));

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    username: String,
    password: String,
  })
);

const Poll = mongoose.model(
  "Poll",
  new mongoose.Schema({
    question: String,
    options: [{ answer: String, votes: Number }],
  })
);

const Vote = mongoose.model(
  "Vote",
  new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    pollId: mongoose.Schema.Types.ObjectId,
    option: String,
  })
);
