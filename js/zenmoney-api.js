function Zenmoney() {
    this.debug = true;

    this.oauth = {};
    this.oauth.consumerKey = 'ge3697d22f738bca8fbeffa8c7ead0';
    this.oauth.consumerSecret = '1194fef2bd';
    this.oauth.requestTokenEndpoint = 'http://api.zenmoney.ru/oauth/request_token';
    this.oauth.accessTokenEndpoint = 'http://api.zenmoney.ru/oauth/access_token';
    this.oauth.authorizeUrl = 'http://api.zenmoney.ru/access/?mobile';
    this.oauth.callbackUrl = 'http://dev.local/zenmoney-chrome-ext/';
    this.oauth.resourceUrl = 'http://api.zenmoney.ru/';
    this.oauth.verifier = null;

    this.oauth.getRequestTokenParams = function () {
        return {
            oauth_consumer_key: this.consumerKey,
            oauth_signature_method: 'PLAINTEXT',
            oauth_signature: this.signature,
            oauth_nonce: this.nonce,
            oauth_timestamp: Math.round(new Date().getTime() / 1000.0),
            oauth_callback: this.callbackUrl,
            oauth_version: '1.0'
        };
    }

    this.oauth.getAccessTokenParams = function () {
        return {
            oauth_consumer_key: this.consumerKey,
            oauth_signature_method: 'PLAINTEXT',
            oauth_signature: this.signature,
            oauth_nonce: this.nonce,
            oauth_timestamp: Math.round(new Date().getTime() / 1000.0),
            oauth_callback: this.callbackUrl,
            oauth_version: '1.0',
            oauth_token: this.token,
            oauth_verifier: this.verifier
        };
    }

    this.oauth.getRequestParams = function () {
        return {
            oauth_consumer_key: this.consumerKey,
            oauth_token: this.token,
            oauth_timestamp: Math.round(new Date().getTime() / 1000.0),
            oauth_signature_method: 'PLAINTEXT',
            oauth_signature: this.signature,
            oauth_nonce: this.nonce
        }
    }

    Object.defineProperties(
        this.oauth,
        {
            nonce: {
                get: function () {
                    var result = '',
                        i = 0,
                        rnum,
                        chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                        cLength = chars.length;

                    for (i = 0; i < 32; ++i) {
                        rnum = Math.floor(Math.random() * cLength);
                        result += chars.substring(rnum, rnum + 1);
                    }

                    return result;
                },
                enumerable: true,
                configurable: false
            },
            signature: {
                get: function () {
                    var result = '';

                    result = this.consumerSecret + '&' + (this.tokenSecret == null ? '' : this.tokenSecret);

                    return result;
                },
                enumerable: true,
                configurable: false
            },
            token: {
                get: function () {
                    var result = '';

                    result = localStorage.getItem('zwe_oauth_token');

                    return result;
                },
                set: function (token) {
                    localStorage.setItem('zwe_oauth_token', token);
                },
                enumerable: true,
                configurable: false
            },
            tokenSecret: {
                get: function () {
                    var result = '';

                    result = localStorage.getItem('zwe_oauth_token_secret');

                    return result;
                },
                set: function (tokenSecret) {
                    localStorage.setItem('zwe_oauth_token_secret', tokenSecret);
                },
                enumerable: true,
                configurable: false
            },
            tokenType: {
                get: function () {
                    var result = '';

                    result = localStorage.getItem('zwe_oauth_token_type');

                    return result;
                },
                set: function (tokenType) {
                    localStorage.setItem('zwe_oauth_token_type', tokenType);
                },
                enumerable: true,
                configurable: false
            }
        }
    );
}

Zenmoney.prototype.request = function (uri, params, method) {
    if (method == undefined) method = 'GET';

    var xhr = new XMLHttpRequest(),
        response = '',
        sendParams = null;

    xhr.onload = function () {

        if (this.status < 200 || this.status > 299) {
            throw new Error('Response status is not OK');
        }

        response = this.responseText;
    };

    if (method == 'GET') {
        uri = this.createUrl(uri, params);
    } else {
        sendParams = this.createParamsString(params);
    }

    xhr.open(method, this.createUrl(uri, params), false);

    xhr.send();

    return response;
}

Zenmoney.prototype.createParamsString = function (params, glue, paramEnclosure) {
    if (glue == undefined) glue = '&';
    if (paramEnclosure == undefined) paramEnclosure = '';

    var paramArray = [];

    for (param in params) {
        paramArray.push(encodeURIComponent(param) + '=' + paramEnclosure + encodeURIComponent(params[param]) + paramEnclosure);
    }

    return paramArray.join(glue);
}

Zenmoney.prototype.createUrl = function (uri, params) {
    var url = uri,
        appender = '?';

    if (!params) {
        return uri;
    }

    if (url.indexOf('?') > 0) {
        appender = '&';
    }

    url += appender + this.createParamsString(params);

    return url;
}

Zenmoney.prototype.redirectToLogin = function (loginUrlStr) {
    var params = {
        oauth_token: this.oauth.token
    };

    window.location.href = this.createUrl(this.oauth.authorizeUrl, params);
}


Zenmoney.prototype.saveToken = function (data, type) {
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

Zenmoney.prototype.wipeToken = function () {
    localStorage.removeItem('zwe_oauth_token');
    localStorage.removeItem('zwe_oauth_token_secret');
    localStorage.removeItem('zwe_oauth_token_type');
}

Zenmoney.prototype.saveVerifier = function (data) {
    var verifier;

    if (data.indexOf('oauth_verifier') >= 0) {
        verifier = data.split('&')[1].split('=')[1];
        this.oauth.verifier = verifier;
    } else {
        throw new Error('Can\'t save oauth verifier');
    }

    return this;
}

Zenmoney.prototype.isAuthorized = function () {
    this.log('Check authorization');

    //TODO: Add check for token lifetime
    if (this.oauth.token != null && this.oauth.tokenType == 'access') {
        this.log('Authorized!');
        return true;
    }

    this.log('Not authorized =(');
    return false;
}

Zenmoney.prototype.authorize = function () {
    this.log('Start authorization');

    if (this.oauth.token != null) {
        try {
            this.log('Save verifier from: %s', window.location.href);
            this.saveVerifier(window.location.href);
        } catch (e) {
            this.wipeToken();
            throw new Error(e.message);
        }

        this.log('Requesting access token');
        var accessTokenData = this.request(
            this.oauth.accessTokenEndpoint,
            this.oauth.getAccessTokenParams(),
            'GET'
        );
        this.log('Received data: %s', accessTokenData);
        this.saveToken(accessTokenData, 'access');
        this.log('Token type: %s; Token: %s; Token secret %s', this.oauth.tokenType, this.oauth.token, this.oauth.tokenSecret);
    } else {
        this.log('Requesting request token');

        var requestTokenData = this.request(
            this.oauth.requestTokenEndpoint,
            this.oauth.getRequestTokenParams(),
            'GET'
        );
        this.log('Received data: %s', requestTokenData);
        this.saveToken(requestTokenData, 'request');
        this.log('Token type: %s; Token: %s; Token secret %s', this.oauth.tokenType, this.oauth.token, this.oauth.tokenSecret);
        this.log('Redirecting to service provider');

        if (this.debug) {
            confirm('Proceed with redirect?');
        }

        this.redirectToLogin();
    }
}

Zenmoney.prototype.log = function () {
    if (this.debug == true) {
        console.log.apply(console, arguments);
    }
}

Zenmoney.prototype.getTransactions = function() {
    var data;

    data = zenmoney.request(
        zenmoney.oauth.resourceUrl + 'v1/transaction/',
        zenmoney.oauth.getRequestParams()
    );

    data = JSON.parse(data);
}
