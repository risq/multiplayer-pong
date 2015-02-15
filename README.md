# multiplayer-pong


##Testing

### Online :

**Connect to http://mpong.valentinledrapier.com**

### Local :

> git clone git@github.com:risq/multiplayer-pong.git multiplayer-pong

Edit `./public/config.json` and specify the local url & port (defaults are `localhost` & `80` ). Then :

> cd multiplayer-pong

> npm install

> gulp bundle:dev

> node app.js


## Building APK

### Building static files :

> gulp build

> cp -R dist/* cordova/www/

### Building Cordova-Crosswalk core :

( See https://crosswalk-project.org/documentation/cordova/migrate_an_application.html )

> cd cordova/platforms/android/CordovaLib/

> android update project --subprojects --path . --target "android-19"

> ant debug

> cd ../../..

> cordova build


## Developping

Server watcher :
> nodemon app.js

Client watcher :
> gulp watch