/**
 * Expo config plugin — adds the App Group entitlement to the main app target
 * so it can share UserDefaults with the FinanceWidget extension.
 *
 * The App Group identifier must match the value used in FinanceWidget.swift
 * (appGroupID constant: "group.com.reduvia.mobile").
 */
const { withEntitlementsPlist } = require("@expo/config-plugins");

const APP_GROUP = "group.com.reduvia.mobile";

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @returns {import('@expo/config-plugins').ExpoConfig}
 */
function withAppGroup(config) {
  return withEntitlementsPlist(config, (mod) => {
    const existing =
      mod.modResults["com.apple.security.application-groups"] ?? [];

    if (!existing.includes(APP_GROUP)) {
      mod.modResults["com.apple.security.application-groups"] = [
        ...existing,
        APP_GROUP,
      ];
    }

    return mod;
  });
}

module.exports = withAppGroup;
