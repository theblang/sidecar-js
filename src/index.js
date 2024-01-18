const Statsig = require('statsig-js').default;

window["StatsigSidecar"] = window["StatsigSidecar"] || {
  getStableID: function() {
    const key = 'STATSIG_LOCAL_STORAGE_STABLE_ID';
    let sid = window.localStorage ? window.localStorage.getItem(key) : null;
    if (!sid) {
      sid = crypto.randomUUID();
      if (window.localStorage) {
        window.localStorage.setItem(key, sid);
      }
    }
    return sid;
  },

  getStatsigUser: function() {
    const sid = this.getStableID();
    return {
      userID: sid,
      customIDs: {
        stableID: sid,
      },
      custom: {
        url: window.location.href,
        page_url: window.location.href,
        language: window.navigator.language,
      },
    };
  },

  performContentChange: function(query, value) {
    const element = document.querySelector(query);
    if (element) {
      element.innerHTML = value;
    }
  },

  performStyleChange: function(query, value) {
    const element = document.querySelector(query);
    if (element) {
      element.setAttribute('style', value);
    }
  },

  performInjectScript: function(value, nonce) {
    const script = document.createElement('script');
    script.setAttribute('nonce', nonce);
    script.nonce = nonce;
    script.innerHTML = value;
    document.head.appendChild(script);
  },

  performInjectStyle: function(value) {
    const style = document.createElement('style');
    style.innerHTML = value;
    document.head.appendChild(style);
  },

  performDirective: function(directive, nonce) {
    switch (directive.actionType) {
      case 'content-change':
        this.performContentChange(directive.queryPath, directive.value);
        break;

      case 'style-change':
        this.performStyleChange(directive.queryPath, directive.value);
        break;

      case 'inject-script':
        this.performInjectScript(directive.value, nonce);
        break;

      case 'inject-style':
        this.performInjectStyle(directive.value);
        break;
    }
  },

  performExperiments: function(expIds, nonce) {
    if (Array.isArray(expIds)) {
      expIds.forEach((expId) => {
        const expConfig = Statsig.getExperiment(expId);
        const directives = expConfig.get('directives', []);
        directives.forEach((directive) => {
          this.performDirective(directive, nonce);
        });
      });
    }
    this.resetBody();
  },

  resetBody: function() {
    const sbpd = document.getElementById('__sbpd');
    if (sbpd) {
      sbpd.parentElement.removeChild(sbpd);
    }
  },

  setupStatsigSdk: async function(apiKey, expIds, nonce) {
    if (!Statsig.instance) {
      const user = this.getStatsigUser();
      await Statsig.initialize(apiKey, user);
    }
    this.performExperiments(expIds, nonce);
  },
}

if (document.currentScript && document.currentScript.src) {
  const url = new URL(document.currentScript.src);
  const apiKey = url.searchParams.get('apikey');
  const multiExpIds = url.searchParams.get('multiexpids')
  if (apiKey && multiExpIds) {
    document.write('<style id="__sbpd">body { display: none; }</style>\n');
    const expIds = multiExpIds.split(',');
    StatsigSidecar.setupStatsigSdk(apiKey, expIds, document.currentScript.nonce);
  }
}
