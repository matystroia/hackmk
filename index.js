const express = require('express');
const passport = require('passport');
const Strategy = require('passport-facebook').Strategy;
const graph = require('fbgraph');

let profileId;


function getFriends(profileId) {
    return new Promise(function (resolve) {
        graph.get(profileId + "/friends", function (err, res) {
            resolve(res.data.summary.total_count);
        });
    })
}

function getPostsStatsRecursive(page, posts, resolve, reactionPromises) {
    graph.get(page, function (err, res) {
        if ('error' in res) {
            console.log(res);
            Promise.all(reactionPromises).then(function () {
                console.log(posts);
                resolve(posts);
            });
        }
        else {
            res.data.forEach(function (post) {
                if ('comments' in post) {
                    let commentCount = post.comments.summary.total_count;
                    let shareCount = ('shares' in post) ? post.shares.count : 0;

                    posts[post.id] = {};
                    posts[post.id].commentCount = commentCount;
                    posts[post.id].shareCount = shareCount;

                    reactionPromises.push(getPostReactions(post.id, posts[post.id]));
                }
                else
                    console.log('Error at post ' + post.id);
            });

            if (res.paging && res.paging.next)
                getPostsStatsRecursive(res.paging.next, posts, resolve, reactionPromises);
            else {
                Promise.all(reactionPromises).then(function () {
                    console.log(posts);
                    resolve(posts);
                });
            }
        }
    });
}

function getPostsStats(profileId) {
    return new Promise(function (resolve) {
        let posts = {};
        let reactionPromises = [];
        getPostsStatsRecursive('me/feed?fields=shares,comments.summary(true).limit(0)', posts, resolve, reactionPromises);
    });
}

function getPostReactionsRecursive(page, reactions, resolve) {
    graph.get(page, function (err, res) {
        res.data.forEach(function (reaction) {
            if (reaction.type in reactions)
                reactions[reaction.type]++;
            else
                reactions[reaction.type] = 1;
        });

        if (res.paging && res.paging.next)
            getPostReactionsRecursive(res.paging.next, reactions, resolve);
        else
            resolve(reactions);
    })
}

function getPostReactions(postId, post) {
    return new Promise(function (resolve) {
        let reactions = {};
        getPostReactionsRecursive(postId + '/reactions', reactions, resolve);
    }).then(function (reactions) {
        post.reactions = reactions;
    });
}

// Configure the Facebook strategy for use by Passport.
//
// OAuth 2.0-based strategies require a `verify` function which receives the
// credential (`accessToken`) for accessing the Facebook API on the user's
// behalf, along with the user's profile.  The function must invoke `cb`
// with a user object, which will be set at `req.user` in route handlers after
// authentication.
passport.use(new Strategy({
        clientID: '338340539949022',
        clientSecret: '7e9e3ec1ae9b2d02e0415460044885b7',
        callbackURL: 'http://localhost:3000/auth/facebook/callback'
    },
    function (accessToken, refreshToken, profile, cb) {
        // In this example, the user's Facebook profile is supplied as the user
        // record.  In a production-quality application, the Facebook profile should
        // be associated with a user record in the application's database, which
        // allows for account linking and authentication with other identity
        // providers.
        // graph.setAccessToken(accessToken);
        // graph.setVersion("2.12");
        // profileId = profile.id;
        graph.setAccessToken(accessToken);

        return cb(null, {profile: profile, accessToken: accessToken});
    }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete Facebook profile is serialized
// and deserialized.
passport.serializeUser(function (user, cb) {
    cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
    cb(null, obj);
});


// Create a new Express application.
const app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({extended: true}));
app.use(require('express-session')({secret: 'keyboard cat', resave: true, saveUninitialized: true}));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());


// Define routes.
app.get('/',
    function (req, res) {

        getPostsStats(req.user.profile.id);

        // graph.get("me/posts", function (err, res) {
        //     graph.get(res.data[0].id.toString() + '/likes', {summary: 'true'}, function (err, res) {
        //         console.log(res);
        //     });
        //
        // });

        res.render('home', {user: req.user.profile});
    });

app.get('/auth/facebook',
    passport.authenticate('facebook', {scope: ['user_posts', 'user_friends', 'user_photos', 'user_tagged_places', 'user_events', 'publish_actions']}));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', {
        successRedirect: '/',
        failureRedirect: '/login'
    }));

// app.get('/profile',
//     require('connect-ensure-login').ensureLoggedIn(),
//     function (req, res) {
//         res.render('profile', {user: req.user});
//     });

app.listen(3000);