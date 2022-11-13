'use strict';

// canvas colors
const COLOR_NORMAL = '#00FF00'; // Lime
const COLOR_HIGHLIGHT = '#FFFFFF'; // White
const COLOR_TEXT = '#000000'; // Black

// global vars
var threshold = 0.0;
var highlight = '';
var filter_list = [];
var predictions = [];

// Refreshes the label icons visibility
function updateLabelIcons() {
  $('.label-icon').hide();
  for (var i = 0; i < predictions.length; i++) {
    var icon_id = '#label-icon-' + predictions[i]['label_id'];
    if (predictions[i]['probability'] > threshold) {
      $(icon_id).show();
    }
  }
}

// a visibility filter for threshold and and label blacklist
function displayBox(i) {
  return predictions[i]['probability'] > threshold
    && !filter_list.includes(predictions[i]['label_id']);
}

function clearCanvas() {
  $('#image-display').empty(); // removes previous img and canvas
  predictions = []; // remove any previous metadata
  updateLabelIcons(); // reset label icons
}

// (re)paints canvas (if canvas exists) and triggers label visibility refresh
function paintCanvas() {
  updateLabelIcons();

  if ($('#image-canvas').length) {

    var ctx = $('#image-canvas')[0].getContext('2d');
    var can = ctx.canvas;

    var img = $('#user-image');
    can.width = img.width();
    can.height = img.height();

    ctx.clearRect(0, 0, can.width, can.height);

    ctx.font = '16px "IBM Plex Sans"';
    ctx.textBaseline = 'top';
    ctx.lineWidth = '3';

    for (var i = 0; i < predictions.length; i++) {
      if (displayBox(i)) {
        if (predictions[i]['label_id'] === highlight) {
          ctx.strokeStyle = COLOR_HIGHLIGHT;
        } else {
          ctx.strokeStyle = COLOR_NORMAL;
        }
        paintBox(i, ctx, can);
      }
    }

    for (i = 0; i < predictions.length; i++) {
      if (displayBox(i)) {
        paintLabelText(i, ctx, can);
      }
    }
  }
}

// module function for painting bounding box on canvas
function paintBox(i, ctx, can) {
  ctx.beginPath();
  var corners = predictions[i]['detection_box'];
  var ymin = corners[0] * can.height;
  var xmin = corners[1] * can.width;
  var bheight = (corners[2] - corners[0]) * can.height;
  var bwidth = (corners[3] - corners[1]) * can.width;
  ctx.rect(xmin, ymin, bwidth, bheight);
  ctx.stroke();
}

// module function for painting label text on canvas
function paintLabelText(i, ctx, can) {
  var probability = predictions[i]['probability'];
  var box = predictions[i]['detection_box'];
  var y = box[0] * can.height;
  var x = box[1] * can.width;
  var bwidth = (box[3] - box[1]) * can.width;

  var label = predictions[i]['label'];
  var prob_txt = (probability * 100).toFixed(1) + '%';
  var text = label + ' : ' + prob_txt;

  var tWidth = ctx.measureText(text).width;
  if (tWidth > bwidth) {
    tWidth = ctx.measureText(label).width;
    text = label;
  }
  var tHeight = parseInt(ctx.font, 10) * 1.4;

  if (predictions[i]['label_id'] === highlight) {
    ctx.fillStyle = COLOR_HIGHLIGHT;
  } else {
    ctx.fillStyle = COLOR_NORMAL;
  }
  ctx.fillRect(x, y, tWidth + 3, tHeight);

  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(text, x + 1, y);
}

// Take uploaded image, display to canvas and run model
function submitImageInput(event) {

  if ($('#file-input').val() !== '') {
    // Stop form from submitting normally
    event.preventDefault();

    clearCanvas();
    // Create form data
    var form = event.target;
    // var file = form[0].files[0];
    // var file1 = form[0].files[1];
    var data = new FormData();
    // data.append('vehicle_image', file);
    // data.append('vehicle_image', file1);

    let len;
    for (let i = 0, len = form[0].files.length; i < len; i++) {
          data.append('vehicle_image', form[0].files[i]);
        }

    // data.append('threshold', 0);

    // Display image on UI
    var reader = new FileReader();
    reader.onload = function(event) {
      var file_url = event.target.result;
      var img_html = '<img id="user-image" src="' + file_url + '" />'
        + '<canvas id="image-canvas"></canvas>';
      $('#image-display').html(img_html); // replaces previous img and canvas
      predictions = []; // remove any previous metadata
      updateLabelIcons(); // reset label icons
    };
    // reader.readAsDataURL(form[0].files[1]);
    sendImage(data);
  }

}

// Enable the webcam
function runWebcam() {
  clearCanvas();
  var video_html = '<video playsinline autoplay></video>';
  $('#webcam-video').html(video_html);
  var video = document.querySelector('video');

  var constraints = {
    audio: false,
    video: { width: 9999, height: 9999 },
  };

  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    window.stream = stream; // make stream available to browser console
    video.srcObject = stream;
  }).catch(function(error) {
    console.log(error.message, error.name);
  });

  // Disable image upload
  $('#file-submit').prop('disabled', true);

  // Reset button
  $('#webcam-btn').removeClass('btn-primary').addClass('btn-danger shutter-btn')
    .text('Snap Picture').click(webcamImageInput).off('click', runWebcam);
}

// Output video frame to canvas and run model
function webcamImageInput() {
  var video = document.querySelector('video');
  $('#image-display').html('<canvas id="image-canvas"></canvas>');
  var canvas = document.querySelector('#image-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  var img = document.createElement('img');
  img.id = 'user-image';
  img.src = canvas.toDataURL();
  $('#image-display').prepend(img);

  window.stream.getVideoTracks()[0].stop();
  $('#webcam-video').empty();

  canvas.toBlob(function(blob) {
    var data = new FormData();
    data.append('vehicle_image', blob);
    // data.append('threshold', 0);
    sendImage(data);
  });

  paintCanvas();

  // Reset button
  $('#webcam-btn').removeClass('shutter-btn btn-danger').addClass('btn-primary')
    .text('New Picture?').off('click', webcamImageInput).click(runWebcam);

  // Re-enable image upload
  $('#file-submit').prop('disabled', false);
}

// Send image to model endpoint
function sendImage(data) {
  // response.setHeader("Access-Control-Allow-Origin", "*");
  // response.setHeader("Access-Control-Allow-Credentials", "true");
  // response.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  // response.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");

  $('#file-submit').text('Detecting...');
  $('#file-submit').prop('disabled', true);
  
  var settings = {
    "url": "http://dd.demo.shizentech.com:8080/api/token",
    "method": "GET",
    "timeout": 0,
    "headers": {
      "content-type": "application/json"
    },
  };
  
  $.ajax(settings).done(function (response) {
    // console.log(response['access_token']);
    // console.log(response['detection_api']);

  $.ajax({
    url: response['detection_api'],
    method: 'post',
    processData: false,
    contentType: false,
    data: data,
    headers: {
      Authorization: 'Bearer ' + response['access_token']
  },
    dataType: 'json',
  //   statusCode: {
  //     400: function (data) {
  //       alert(data);
  //     },
  //     200: function (data) {
  //       console.log(data)
  //       $('#label-icons').empty()
  //       for (let i = 0, len = data.length; i < len; i++) {
  //             console.log(data[i]['data']['OutputImage']);
  //             $('#label-icons').append(`<a href="${data[i]['data']['OutputImage']}">${data[i]['image']}</a> <br>`);
  //         }
  //       // alert(response);
  //     }
  // },
    success: function(data) {
      // predictions = data['predictions'];
      // paintCanvas();
      // if (predictions.length === 0) {
      //   alert('No Objects Detected');
      // }
      console.log(data)
      let len;
      $('#label-icons').empty()
      for (let i = 0, len = data.length; i < len; i++) {
            console.log(data[i]['data']['OutputImage']);
            $('#label-icons').append(`<a href="${data[i]['data']['OutputImage']}">${data[i]['image']}</a> <br>`);
          }
    },
    error: function(jqXHR, status, error) {
      console.log(jqXHR.responseText)
      alert('Object Detection Failed: ' + jqXHR.responseText);
    },
    complete: function() {
      $('#file-submit').text('Submit');
      $('#file-submit').prop('disabled', false);
      $('#file-input').val('');
    },
  });
  });

  // Perform file upload
}

// Run or bind functions on page load
$(function() {
  // Update canvas when window resizes
  $(window).resize(function(){
    paintCanvas();
  });

  // Image upload form submit functionality
  $('#file-upload').on('submit', submitImageInput);

  // Enable webcam
  $('#webcam-btn').on('click', runWebcam);

  // Update threshold value functionality
  $('#threshold-range').on('input', function() {
    $('#threshold-text span').html(this.value);
    threshold = $('#threshold-range').val() / 100;
    paintCanvas();
  });

  // Populate the label icons on page load
  // $.get('/model/labels', function(result) {
  //   $.each(result['labels'], function(i, label) {
  //     $('#label-icons').append($('<img>', {
  //       class: 'label-icon',
  //       id: 'label-icon-' + label.id,
  //       title: label.name,
  //       src: '/img/cocoicons/' + label.id + '.jpg',
  //     }));
  //   });

  //   // Add an "onClick" for each icon
  //   $('.label-icon').on('click', function() {
  //     var this_id = $(this).attr('id').match(/\d+$/)[0];
  //     if ($(this).hasClass('hide-label')) {
  //       $(this).removeClass('hide-label');
  //       filter_list.splice(filter_list.indexOf(this_id), 1);
  //     } else {
  //       $(this).addClass('hide-label');
  //       filter_list.push(this_id);
  //     }
  //     paintCanvas();
  //   });

  //   // Add mouse over for each icon
  //   $('.label-icon').hover(function() {
  //     highlight = $(this).attr('id').match(/\d+$/)[0];
  //     paintCanvas();
  //   }, function() {
  //     highlight = '';
  //     paintCanvas();
  //   });
  // });
});

//auth 0 
// The Auth0 client, initialized in configureClient()
let auth0Client = null;

/**
 * Starts the authentication flow
 */
const login = async (targetUrl) => {
  try {
    console.log("Logging in", targetUrl);

    const options = {
      authorizationParams: {
        redirect_uri: window.location.origin
      }
    };

    if (targetUrl) {
      options.appState = { targetUrl };
    }

    await auth0Client.loginWithRedirect(options);
  } catch (err) {
    console.log("Log in failed", err);
  }
};

/**
 * Executes the logout flow
 */
const logout = async () => {
  try {
    console.log("Logging out");
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  } catch (err) {
    console.log("Log out failed", err);
  }
};

/**
 * Retrieves the auth configuration from the server
 */
const fetchAuthConfig = () => fetch("/auth_config.json");

/**
 * Initializes the Auth0 client
 */
const configureClient = async () => {
  const response = await fetchAuthConfig();
  const config = await response.json();

  auth0Client = await auth0.createAuth0Client({
    domain: config.domain,
    clientId: config.clientId
  });
};

/**
 * Checks to see if the user is authenticated. If so, `fn` is executed. Otherwise, the user
 * is prompted to log in
 * @param {*} fn The function to execute if the user is logged in
 */
const requireAuth = async (fn, targetUrl) => {
  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    return fn();
  }

  return login(targetUrl);
};

// Will run when page finishes loading
window.onload = async () => {
  await configureClient();

  // If unable to parse the history hash, default to the root URL
  if (!showContentFromUrl(window.location.pathname)) {
    showContentFromUrl("/");
    window.history.replaceState({ url: "/" }, {}, "/");
  }

  const bodyElement = document.getElementsByTagName("body")[0];

  // Listen out for clicks on any hyperlink that navigates to a #/ URL
  bodyElement.addEventListener("click", (e) => {
    if (isRouteLink(e.target)) {
      const url = e.target.getAttribute("href");

      if (showContentFromUrl(url)) {
        e.preventDefault();
        window.history.pushState({ url }, {}, url);
      }
    }
  });

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    console.log("> User is authenticated");
    window.history.replaceState({}, document.title, window.location.pathname);
    updateUI();
    return;
  }
 

  console.log("> User not authenticated");
  const query = window.location.search;
  const shouldParseResult = query.includes("code=") && query.includes("state=");

  if (shouldParseResult) {
    console.log("> Parsing redirect");
    try {
      const result = await auth0Client.handleRedirectCallback();
      console.log(result)
      if (result.appState && result.appState.targetUrl) {
        showContentFromUrl(result.appState.targetUrl);
      }

      console.log("Logged in!");
    } catch (err) {
      console.log("Error parsing redirect:", err);
      window.location.href="/login.html"
    }

    window.history.replaceState({}, document.title, "/");
  }

  updateUI();

};
