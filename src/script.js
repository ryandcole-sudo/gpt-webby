var chat;
var chatText;
var chatBtn;
var chatRecBtn;
var chatForm;
var modalBox;
var chatLoad;

var docroot;

var coreEmbeds;

function main(){
    
    chat = document.querySelector(".chatbox");
    chatText = chat.querySelector("input");
    chatBtn = chat.querySelector("button");
    modalBox = document.querySelector("#modalBox");
    modalForm = document.querySelector("#modalForm");
    docroot = document.querySelector(".document-root");
    chatForm = document.querySelector("#chatform");
    chatLoad = document.querySelector(".load-icon");

    chatLoad.style.display = "none";

    if(getAPIKey() === null){
        modalBox.showModal();
    }

    //Create (and cache) some core embeddings for use
    createCoreEmbeddings();
    modalForm.addEventListener("submit", function(e){
        e.preventDefault();
        var key = modalForm.querySelector("input");
        localStorage.setItem("APIKEY",key.value);
        modalBox.close();
    });
    chatForm.addEventListener("submit", function(e){
        e.preventDefault();
        Embed([chatText.value])
        .then( array => {
            getUserIntent(array[0][1]);
        });
        //editPage(chatText.value); TODO
        chatForm.reset();
    });

    window.addEventListener("keydown", function(e){
        if(e.key == "m"){
            Listen();
        }
    });
}

function getAPIKey(){
    //Retrieves the users API key from local storage
    var key = localStorage.getItem("APIKEY");
    return key;
}
function createCoreEmbeddings(){

    //Command vs Question
    var cmdEmbeds = [" (please) (can you) Do it!","What/how is it?/Can it be?"];
    
    //Allow the user to undo or revert
    var revertEmbeds = ["Do/add this","Undo/revert this"];
    
    //Determine how specific the user is
    var specEmbeds = ["It/that does (not specific)","This/that does (specific)"];

    var coreEmbedsArray = [...cmdEmbeds,...revertEmbeds,...specEmbeds];
    Embed(coreEmbedsArray)
    .then( array => {
      coreEmbeds = array;
    }
    );
}

async function Embed(textArray){
    var request = {
        "model":"text-embedding-ada-002",
        "input":textArray
    };

    var header = {
        "Content-Type":"application/json",
        "Authorization": `Bearer ${getAPIKey()}` 
    };

    var embed = [];

    await fetch("https://api.openai.com/v1/embeddings",
    {
        method:"post",
        headers:header,
        body:JSON.stringify(request)
    }
    )
    .then(response => response.json())
    .then(object => {
        var de = object.data;
        embed = object.data.map( data =>
        [textArray[de.indexOf(data)],data.embedding] );
    });
   return embed;
}

async function EditText(text,command){
    var request = {
        "model":"code-davinci-edit-001",
        "input":text,
        "instruction":command,
        "temperature":0.3
    };

    var header = {
        "Content-Type":"application/json",
        "Authorization": `Bearer ${getAPIKey()}` 
    };

    var editedText;

    await fetch("https://api.openai.com/v1/edits",
    {
        method:"post",
        headers:header,
        body:JSON.stringify(request)
    })
    .then(response => response.json())
    .then(object => {
        editedText = object.choices[0].text;
    });
    return editedText;
}

function Listen(){
    //Feature detect
    if(window.webkitSpeechRecognition)
        SpeechRecognition = webkitSpeechRecognition;

    if(!window.SpeechRecognition)
        return null;

    // Create a new instance of SpeechRecognition
    var recognition = new SpeechRecognition();

    // Set some options
    recognition.lang = 'en-US'; // Set the language
    recognition.continuous = true; // Keep listening even if the user pauses
    recognition.interimResults = false; // Don't show interim results

    // Define a callback function for when recognition starts
    recognition.onstart = function() {
        console.log('Speech recognition started');
    };

    // Define a callback function for when recognition returns a result
    recognition.onresult = function(event) {
        // Get the transcript of what was said
        var transcript = event.results[0][0].transcript;
            console.log('You said: ' + transcript);
            chatText.value = transcript;
            chatForm = document.querySelector("#chatform");
            var submit = new Event("submit");
            chatForm.dispatchEvent(submit);
            recognition.stop();
        };

        // Define a callback function for when recognition encounters an error
        recognition.onerror = function(event) {
            console.log('Speech recognition error: ' + event.error);
        };

        // Start the recognition service
        recognition.start();
}

async function editPage(command){
    var prompt = "<!--This is done using Tailwind. Icons are generated with Font awesome  -->\n";
    var doc = prompt + docroot.outerHTML;
    chatLoad.style.display = "inline-block";
    var text = await EditText(doc,command);
    chatLoad.style.display = "none";
    docroot.outerHTML = text;
    docroot = document.querySelector("main");
}
function getUserIntent(embed){
    //Try to determine whether the user asked a question or gave an instruction
    var commandEm = coreEmbeds[0][1];
    var questionEm = coreEmbeds[1][1];
    var question = np_dot(embed,commandEm) < np_dot(embed,questionEm);

    //Try to determine whether wants to undo
    var doEm = coreEmbeds[2][1];
    var undoEm = coreEmbeds[3][1];
    var undo = np_dot(embed,doEm) < np_dot(embed,undoEm);

    //Try to determine how specific the user is
    var itEm = coreEmbeds[3][1];
    var thisEm = coreEmbeds[4][1];
    var spec = np_dot(embed,itEm) < np_dot(embed,thisEm);
    
    console.log("Did the user ask a question? " + question);
    console.log("Does the user want to undo?" + undo);
    console.log("Is the user specific?" + spec + "\n"); 
    
}

function np_dot(a,b){
    return a.reduce( (sum,x,i) => sum + x * b[i],0);
}

window.onload = main;
