function Zenmoney() {
    this.debug = true;

    this.oauth = {};
    this.oauth.consumerKey = 'ge3697d22f738bca8fbeffa8c7ead0';
    this.oauth.consumerSecret = '1194fef2bd';
    this.oauth.requestTokenEndpoint = 'http://api.zenmoney.ru/oauth/request_token';
    this.oauth.accessTokenEndpoint = 'http://api.zenmoney.ru/oauth/access_token';
    this.oauth.authorizeUrl = 'http://api.zenmoney.ru/access/?mobile';
    this.oauth.callbackUrl = 'http://dev.local/zenmoney-chrome-ext/';
    this.oauth.verifier = null;

    Object.defineProperty(
        this.oauth,
        'nonce',
        {
            get : function() {
                var result = '',
                    i = 0,
                    rnum,
                    chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                    cLength = chars.length;

                for (; i < 32; i++) {
                    rnum = Math.floor(Math.random() * cLength);
                    result += chars.substring(rnum, rnum + 1);
                }

                return result;
            },
            enumerable : true,
            configurable : false
        }
    );

    Object.defineProperty(
        this.oauth,
        'signature',
        {
            get : function() {
                var result = '';

                result = this.consumerSecret + '&' + (this.tokenSecret == null ? '' : this.tokenSecret);

                return result;
            },
            enumerable : true,
            configurable : false
        }
    );

    Object.defineProperty(
        this.oauth,
        'token',
        {
            get : function() {
                var result = '';

                result = localStorage.getItem('zwe_oauth_token');

                return result;
            },
            set : function(token) {
                localStorage.setItem('zwe_oauth_token', token);
            },
            enumerable : true,
            configurable : false
        }
    );

    Object.defineProperty(
        this.oauth,
        'tokenSecret',
        {
            get : function() {
                var result = '';

                result = localStorage.getItem('zwe_oauth_token_secret');

                return result;
            },
            set : function(tokenSecret) {
                localStorage.setItem('zwe_oauth_token_secret', tokenSecret);
            },
            enumerable : true,
            configurable : false
        }
    );

    Object.defineProperty(
        this.oauth,
        'tokenType',
        {
            get : function() {
                var result = '';

                result = localStorage.getItem('zwe_oauth_token_type');

                return result;
            },
            set : function(tokenType) {
                localStorage.setItem('zwe_oauth_token_type', tokenType);
            },
            enumerable : true,
            configurable : false
        }
    );
}

Zenmoney.prototype.request = function(uri, params, method) {
    if (method == undefined) method = 'GET';

    var xhr = new XMLHttpRequest(),
        response = '';

    this.log('Start request %s:%s', method, uri);

    xhr.onload = function () {

        if (this.status < 200 || this.status > 299) {
            throw new Error('Response status is not OK');
        }

        response = this.responseText;
    }
    xhr.open(method, this.createUrl(uri, params), false);
    xhr.send();

    return response;
}

Zenmoney.prototype.createParamsString = function(params) {
    var paramArray = [];

    for (param in params) {
        paramArray.push(encodeURIComponent(param) + '=' + encodeURIComponent(params[param]));
    }

    return paramArray.join('&');
}

Zenmoney.prototype.createUrl = function(uri, params) {
    var url = uri,
        appender = '?';

    if (url.indexOf('?') > 0) {
        appender = '&';
    }

    url += appender + this.createParamsString(params);

    return url;
}

Zenmoney.prototype.redirectToLogin = function(loginUrlStr) {
    var params = {
        oauth_token: this.oauth.token
    };

    window.location.href = this.createUrl(this.oauth.authorizeUrl, params);
}


Zenmoney.prototype.saveToken = function(data, type) {
    var token, tokenSecret, tokenData = data.split('&');

    for (var i = 0; i < tokenData.length; i++) {
        if (tokenData[i].indexOf('oauth_token_secret') == 0) {
            tokenSecret = tokenData[i].split('=')[1];
            continue;
        }
        if (tokenData[i].indexOf('oauth_token') == 0) {
            token = tokenData[i].split('=')[1];
        }
    }

    if (token != undefined && tokenSecret != undefined) {
        this.oauth.token = token;
        this.oauth.tokenSecret = tokenSecret;
        this.oauth.tokenType = type;
    }

    return this;
}

Zenmoney.prototype.wipeToken = function() {
    localStorage.removeItem('zwe_oauth_token');
    localStorage.removeItem('zwe_oauth_token_secret');
    localStorage.removeItem('zwe_oauth_token_type');
}

Zenmoney.prototype.saveVerifier = function(data) {
    var verifier;

    if (data.indexOf('oauth_verifier') >= 0) {
        verifier = data.split('&')[1].split('=')[1];
        this.oauth.verifier = verifier;
    } else {
        throw new Error('Can\'t save oauth verifier');
    }

    return this;
}

Zenmoney.prototype.isAuthorized = function() {
    //TODO: Add check for token lifetime
    if (this.oauth.token != null && this.oauth.tokenType == 'access') {
        return true;
    }

    return false;
}

Zenmoney.prototype.authorize = function() {
    if (this.oauth.token != null) {

        try {
            this.saveVerifier(window.location.href);
        } catch (e) {
            zenmoney.wipeToken();
            throw new Error(e.message);
        }

        this.log('Requesting access token');
        var accessTokenData = this.request(
            this.oauth.accessTokenEndpoint,
            {
                oauth_consumer_key: this.oauth.consumerKey,
                oauth_signature_method: 'PLAINTEXT',
                oauth_signature: this.oauth.signature,
                oauth_nonce: this.oauth.nonce,
                oauth_timestamp: Math.round(new Date().getTime()/1000.0),
                oauth_callback: this.oauth.callbackUrl,
                oauth_version: '1.0',
                oauth_token: this.oauth.token,
                oauth_verifier: this.oauth.verifier
            }
        );
        this.log('Received data: %s', accessTokenData);
        this.saveToken(accessTokenData, 'access');
    } else {
        this.log('Requesting request token');
        var requestTokenData = this.request(
            this.oauth.requestTokenEndpoint,
            {
                oauth_consumer_key: this.oauth.consumerKey,
                oauth_signature_method: 'PLAINTEXT',
                oauth_signature: this.oauth.signature,
                oauth_nonce: this.oauth.nonce,
                oauth_timestamp: Math.round(new Date().getTime()/1000.0),
                oauth_callback: this.oauth.callbackUrl,
                oauth_version: '1.0'
            }
        );
        this.log('Received data: %s', requestTokenData);
        this.saveToken(requestTokenData, 'request');
//        this.redirectToLogin();
    }
}

Zenmoney.prototype.log = function() {
    if (this.debug) {
        console.log.apply(console, arguments);
    }
}
