import React from "react";
import HandMusic from "./components/HandMusic";

function App() {
  return (
    <div id ="start-message" className="App">
        <h1 id = "title">Hand Music</h1>
        <label id = "description1">
        An experimental tool and creative outlet that transforms hand gestures into soundscapes. 
        </label>
        <br></br>
        <label id = "description2">
        We invite you to step into a playful, boundary-breaking sonic experience.
        </label>
        <HandMusic />
    </div>
  );
}
export default App;