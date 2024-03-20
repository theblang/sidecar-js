const Statsig = require('statsig-js').default;
const StatsigWA = require('statsig-web-analytics');

window["StatsigSidecar"] = window["StatsigSidecar"] || {
  _statsigInstance: null,

  getStatsigInstance: function() {
    return this._statsigInstance;
  },

  getMatchingExperiments: function() {
    const url = window.location.href;
    const scConfig = this._statsigInstance.getConfig('sidecar_dynamic_config');
    if (!scConfig) {
      return null;
    }
    const exps = scConfig.getValue('activeExperiments', []);
    const matchingExps = [];
    exps.forEach((exp) => {
      const filters = exp.filters || [];
      if (filters.length === 0) {
        matchingExps.push(exp.id);
        return;
      }

      filters.forEach((filter) => {
        if (RegExp(filter).test(url)) {
          matchingExps.push(exp.id);
        }
      });
    });
    return matchingExps;
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
        const expConfig = this._statsigInstance.getExperiment(expId);
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

  setupStatsigSdk: async function(apiKey, expIds, autoStart, nonce) {
    if (!this._statsigInstance) {
      await StatsigWA.initialize(apiKey, autoStart);
      this._statsigInstance = StatsigWA.getStatsigClient();
    }

    if (!expIds) {
      expIds = this.getMatchingExperiments();
    }
    if (!expIds) {
      this.resetBody();
      return;
    }

    this.performExperiments(expIds, nonce);
  },
}

if (document.currentScript && document.currentScript.src) {
  const url = new URL(document.currentScript.src);
  const apiKey = url.searchParams.get('apikey');
  const multiExpIds = url.searchParams.get('multiexpids');
  const autoStart = url.searchParams.get('autostart') !== '0';
  if (apiKey) {
    document.write('<style id="__sbpd">body { display: none; }</style>\n');
    const expIds = multiExpIds ? multiExpIds.split(',') : null;
    StatsigSidecar.setupStatsigSdk(
      apiKey,
      expIds,
      autoStart,
      document.currentScript.nonce,      
    );
  }
}
