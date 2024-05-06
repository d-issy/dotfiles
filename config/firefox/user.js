// disable annoy
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.aboutConfig.showWarning", false);
user_pref("browser.discovery.enabled", false);
user_pref("extensions.htmlaboutaddons.recommendations.enabled", false);
user_pref("extensions.getAddons.showPane", false); // [HIDDEN PREF]
user_pref("extensions.pocket.enabled", false);

// statup
user_pref("browser.startup.page", 3); // 0=blank, 1=home, 2=last visited page, 3=resume previous session

// basics
/// tab groups
user_pref("browser.ctrlTab.sortByRecentlyUsed", false);
user_pref("browser.link.open_newwindow", 3); // 1=tab, 2=window, 3=current tab, 0=same tab
user_pref("browser.tabs.loadInBackground", true);
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.taskbar.previews.enable", false);
/// browsing
user_pref("accessibility.browsewithcaret", false);
user_pref("accessibility.typeaheadfind", true);
user_pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false); // prettier-ignore
user_pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false); // prettier-ignore
user_pref("general.autoScroll", false);
user_pref("general.smoothScroll", true);
user_pref("layout.css.always_underline_links", true);
user_pref("media.hardwaremediakeys.enabled", false);
user_pref("media.videocontrols.picture-in-picture.video-toggle.enabled", true);
user_pref("ui.osk.enabled", false);

// home
user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
user_pref("browser.newtabpage.activity-stream.feeds.topsites", false);
user_pref("browser.newtabpage.activity-stream.section.highlights.includeBookmarks", false); // prettier-ignore
user_pref("browser.newtabpage.activity-stream.section.highlights.includeDownloads", false); // prettier-ignore
user_pref("browser.newtabpage.activity-stream.section.highlights.includePocket", false); // prettier-ignore
user_pref("browser.newtabpage.activity-stream.section.highlights.includeVisited", false); // prettier-ignore
user_pref("browser.newtabpage.activity-stream.showSponsored", false);
user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
user_pref("browser.newtabpage.pinned", "[]");

// privacy
user_pref("browser.contentblocking.category", "strict");
/// for site notify
user_pref("privacy.donottrackheader.enabled", true);
user_pref("privacy.globalprivacycontrol.enabled", true);
/// for passwords
user_pref("signon.autofillForms", false);
user_pref("signon.firefoxRelay.feature", "disabled");
user_pref("signon.generation.enabled", false);
user_pref("signon.management.page.breach-alerts.enabled", false);
user_pref("signon.rememberSignons", false);
// for mozilla notify
user_pref("app.shield.optoutstudies.enabled", false);
user_pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);
user_pref("browser.crashReports.unsubmittedCheck.enabled", false);
user_pref("browser.tabs.crashReporting.sendReport", false);

// disable telemetry
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("toolkit.telemetry.unified", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.server", "data:,");
user_pref("toolkit.telemetry.archive.enabled", false);
user_pref("toolkit.telemetry.newProfilePing.enabled", false);
user_pref("toolkit.telemetry.shutdownPingSender.enabled", false);
user_pref("toolkit.telemetry.updatePing.enabled", false);
user_pref("toolkit.telemetry.bhrPing.enabled", false);
user_pref("toolkit.telemetry.firstShutdownPing.enabled", false);
user_pref("toolkit.telemetry.coverage.opt-out", true);
user_pref("toolkit.coverage.opt-out", true);
user_pref("toolkit.coverage.endpoint.base", "");
user_pref("browser.ping-centre.telemetry", false);
user_pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
user_pref("browser.newtabpage.activity-stream.telemetry", false);

// bookmarks
user_pref("browser.toolbars.bookmarks.visibility", "never");

// custom
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
