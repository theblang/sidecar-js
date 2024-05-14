const Statsig = require('statsig-js').default;
const StatsigClient = require('statsig-js').StatsigClient;
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
      const filterType = exp.filterType || 'all';

      if (this.isMatchingExperiment(filterType, filters)) {
        matchingExps.push(exp.id);
      }
    });
    return matchingExps;
  },

  isMatchingExperiment: function(filterType, filters) {
    if (filterType === 'all' || filters.length === 0) {
      return true;
    }
    const url = window.location.href;
    if (filterType === 'contains') {
      return filters.some((filter) => url.includes(filter));
    } else if (filterType === 'equals') {
      return filters.some((filter) => url === filter);
    } else if (filterType === 'regex') {
      return filters.some((filter) => RegExp(filter).test(url));
    }
    return false;
  },

  performContentChange: function(query, value) {
    const element = document.querySelector(query);
    if (element) {
      element.innerHTML = value;
    }
  },

  performReorderElement: function(query, operator, anchorQuery) {
    const target = document.querySelector(query);
    const anchor = document.querySelector(anchorQuery);
    if (!target || !anchor) {
      return;
    }

    switch (operator) {
      case 'before':
        anchor.before(target);
        break;
      case 'after':
        anchor.after(target);
        break;
      case 'first':
        anchor.prepend(target);
        break;
      case 'last':
        anchor.append(target);
        break;
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

      case 'reorder-element':
        this.performReorderElement(
          directive.queryPath,
          directive.operator,
          directive.anchorQueryPath,
        );
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
    if (window?.postExperimentCallback) {
      window.postExperimentCallback(this._statsigInstance, expIds);
    }
  },

  resetBody: function() {
    const sbpd = document.getElementById('__sbpd');
    if (sbpd) {
      sbpd.parentElement.removeChild(sbpd);
    }
  },

  setupStatsigSdk: async function(apiKey, expIds, autoStart, nonce) {
    let overrideUser = null;
    try {
      const url = new URL(window.location.href);
      overrideUser = url.searchParams.get('overrideuser');
    } catch (e) {
      console.error('Failed to update user:', e);
    }

    if (overrideUser) {
      this._statsigInstance  = new StatsigClient(apiKey, {
        userID: overrideUser,
        customIDs: {
          stableID: overrideUser,
        },
      });
      await this._statsigInstance.initializeAsync();
    } 
    
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
