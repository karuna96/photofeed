var express = require("express");
var app = express();
var AWS = require('aws-sdk');
const fetch = require('node-fetch');
var multer = require('multer');
var bodyParser = require('body-parser');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
global.fetch= require('node-fetch');
global.navigator = () => null;

app.use(multer({ inMemory: true }).single('image'));
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session())

passport.serializeUser(function(user, done) {
    done(null, user);
});
  
passport.deserializeUser(function(user, done) {
    done(null, user);
});

app.set('view engine', 'ejs');

var s3 = new AWS.S3();
var login = 'null';
var username = '';
var profilePicture = '';
var email = '';
const session = {
    secret: 'change this',
    resave: false,
    saveUninitialized: true
}

app.get('/',(req,res)=>{
    fetch('https://figpa1z4gi.execute-api.us-east-1.amazonaws.com/prod/photofeed')
  .then(response => response.json())
  .then(data => {
    res.render('home',{data:data, login:login, username:username, profilePicture:profilePicture, email:email});
  })
  .catch(err => {
      console.log(err);
  })
})

app.get('/uploadpage',(req,res)=>{
    if(login === 'null'){
        res.redirect('/login');
        res.end();
    }
    else{
        res.render('upload');
        res.end();
    }
})

app.post('/upload',(req,res)=>{
    
    if(req.file.buffer !== undefined){

        var data = req.file.buffer;
        var d = new Date();
        var key = d.getTime().toString();
        var myBucket = "node-demo/"+email.substr(0,email.indexOf("@"));
        params = {Bucket: myBucket, Key: key, Body: data, ACL: 'public-read' };

        s3.putObject(params, function(err, data) {
  
            if (err) {
                console.log(err)
            } else {
                        var url ='https://figpa1z4gi.execute-api.us-east-1.amazonaws.com/prod/photofeed/upload';
                        var headers = {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }

                        var data = {
                            "url" : "https://"+myBucket.substr(0,myBucket.indexOf("/"))+".s3.amazonaws.com/"+email.substr(0,email.indexOf("@"))+"/"+key,
                            "privacy": req.body.privacy,
                            "hashtag": req.body.hashtag,
                            "description": req.body.description,
                            "location": req.body.location,
                            "email": email
                        }
                        fetch(url, { method: 'POST', headers:headers, body: JSON.stringify(data)})
                            .then((res) => {
                            })
                            .then((json) => {
                                res.redirect('/');
                            })
                            .catch(err => {
                                console.log(err);
                            });
                    }
        });
    }else{
        res.send("error, no file chosen");
    }
})

const poolData = {
    UserPoolId: 'us-east-1_Eh3K5ew1q',
    ClientId: 'bt0l0kqofug4n5ks38031kkvh'
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

app.get("/signuppage", function (req,res){
    res.render('signup');
});

app.post("/signup", (req,res)=>{

    const email = req.body.email;
    const password= req.body.password;
    const confirmPassword = req.body.confirm_password;

    if( password !== confirmPassword){
        res.redirect('/signup?error=passwords');
    }

    const emailData ={
        Name: 'email',
        Value: email
    }
    const emailAttribute = new AmazonCognitoIdentity.CognitoUserAttribute(emailData);

    userPool.signUp(email, password, [emailAttribute], null, (err, data)=>{
        if(err && err.code !== 'UnknownError'){
            console.error(err);
            return res.redirect('/signup');
        }

        res.redirect("/");
    });
});

app.get('/login', function(req,res){
    res.render('login');
});

app.post('/login', (req,res)=>{

    const loginDetails={
        Username: req.body.email,
        Password: req.body.password
    }
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(loginDetails);

    const userDetails = {
        Username: req.body.email,
        Pool: userPool
    }
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userDetails);

    cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: data => {
                login = 'photofeed';
                username = data.idToken.payload.email.substring(0,data.idToken.payload.email.indexOf('@'));
                email = data.idToken.payload.email;
                res.redirect('/');
            },
            onFailure: err => {
                        console.error(err);
                        
                        return res.redirect('/login');
                    }
    })
});

//-----------------------------------GOOGLE---------------------------------------//

passport.use(new GoogleStrategy({
    clientID: '866489402584-egn0u45838294gqj7gdo74lt2i8bq4sl.apps.googleusercontent.com',
    clientSecret: 'twR2HVTK5DjX_I574RMU4TVT',
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    if (profile) {
        user = profile;
        login = 'google';
        username = user.displayName;
        profilePicture = user.photos[0].value;
        email = user.emails[0].value;
        return done(null, user);
        }
        else {
        return done(null, false);
        }
  }
));

app.get('/auth/google',
  passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/plus.login', 'https://www.googleapis.com/auth/userinfo.email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
});

//--------------------------------FACEBOOK-----------------//

passport.use(new FacebookStrategy({
    clientID: '402961240316510',
    clientSecret: '8b9aeffe7a9ae9e7d14669f6556d0849',
    callbackURL: "http://localhost:3000/auth/facebook/callback",
    profileFields: ['id', 'emails', 'name']
  },
  function(accessToken, refreshToken, profile, done) {
    if (profile) {
        user = profile;
        login = 'facebook';
        username = user._json.first_name + ' ' + user._json.last_name;
        email = user.emails[0].value;
        return done(null, user);
        }
        else {
        return done(null, false);
        }
  }
));

app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['email','public_profile']})
);

app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
});

//------------------------------MYACCOUNT-------------------------------//

app.get('/myAccount',(req,res)=>{
    var url ='https://figpa1z4gi.execute-api.us-east-1.amazonaws.com/prod/photofeed/myaccount?email='+email;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            res.render('myaccount',{data:data, email:email});
        })
        .catch(err => {
             console.log(err);
        })
});

//-------------------------------------LIKEIMAGE---------------------//

app.post('/likeimage',(req,res)=>{
    if(login === 'null'){
        res.redirect('/login');
        res.end();
    }
    else{
        var url ='https://figpa1z4gi.execute-api.us-east-1.amazonaws.com/prod/photofeed/like';
                        var headers = {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }

                        var data = {
                            "likeurl": req.body.imageurl,
                            "likeemail": email
                        }
                        fetch(url, { method: 'POST', headers:headers, body: JSON.stringify(data)})
                            .then((res) => {
                            })
                            .then((json) => {
                                if(req.body.from === 'myaccount'){
                                    res.redirect('/myAccount');
                                }
                            })
                            .catch(err => {
                                console.log(err);
                            });
    }
});

//-----------------------------------COMMENT--------------------------------------//

app.post('/commentpage',(req,res)=>{
    if(login === 'null'){
        res.redirect('/login');
        res.end();
    }
    else{
        var url ='https://figpa1z4gi.execute-api.us-east-1.amazonaws.com/prod/photofeed/comments?url='+req.body.imageurl;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                res.render('comment',{imageemail:req.body.imageemail, imageurl: req.body.imageurl, data:data});
            })
            .catch(err => {
             console.log(err);
            })
    }
});

app.post('/insertcomment',(req,res)=>{
    var url ='https://figpa1z4gi.execute-api.us-east-1.amazonaws.com/prod/photofeed/comments';
    var headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }

    var d=new Date();
    var data = {
        "id": d.getTime().toString(),
        "imageurl": req.body.imageurl,
        "commenter": email,
        "comment": req.body.comment,
        "action": "insert"
    }
    fetch(url, { method: 'POST', headers:headers, body: JSON.stringify(data)})
        .then((res) => {
        })
        .then((json) => {
            res.redirect('/');
        })
        .catch(err => {
            console.log(err);
        });
});

app.get('/signout', (req,res)=>{
    login = 'null';
    username = '';
    profilePicture = '';
    email = '';
    res.redirect('/');
});

app.listen(3000, function(){
    console.log('listening on port: ', 3000);
})