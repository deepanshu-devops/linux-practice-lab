const outputEl = document.getElementById("output");
const form = document.getElementById("command-form");
const commandInput = document.getElementById("command");
const exercisesEl = document.getElementById("exercises");


function appendOutput(text, isError = false) {
  const line = document.createElement("div");
  line.textContent = text;
  if (isError) {
    line.style.color = "#f87171";
  }
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

async function runCommand(command) {
  const response = await fetch("/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command }),
  });
  const result = await response.json();
  if (!response.ok) {
    appendOutput(result.output || "Unknown error", true);
    return;
  }
  if (result.output) appendOutput(result.output.trim());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const command = commandInput.value.trim();
  if (!command) {
    appendOutput("$ ");
    return;
  }
  appendOutput(`$ ${command}`);
  await runCommand(command);
  commandInput.value = "";
});

async function loadExercises() {
  const response = await fetch("/exercises");
  const exercises = await response.json();
  exercisesEl.innerHTML = "";
  exercises.forEach((exercise) => {
    const item = document.createElement("div");
    item.className = "exercise-item";
    item.innerHTML = `
      <h3>${exercise.title}</h3>
      <p>${exercise.description}</p>
      <div class="hint"><strong>Hint:</strong> ${exercise.hint}</div>
    `;
    exercisesEl.appendChild(item);
  });
}

loadExercises();
