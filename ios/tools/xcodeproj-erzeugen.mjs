/**
 * Erzeugt Nebenkosten.xcodeproj aus dem Dateibaum.
 *
 *     node ios/tools/xcodeproj-erzeugen.mjs
 *
 * Die Projektdatei wird bewusst generiert statt von Hand gepflegt: Die
 * Objektkennungen leiten sich aus den Dateipfaden ab, das Ergebnis ist damit
 * reproduzierbar und lässt sich maschinell prüfen
 * (siehe xcodeproj-pruefen.mjs).
 */

import { createHash } from 'node:crypto';
import { readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = join(WURZEL, 'Nebenkosten.xcodeproj');

const PROJEKT = 'Nebenkosten';
const BUNDLE_ID = 'de.spachmann.nebenkosten';
const IOS_ZIEL = '16.0';

/** Deterministische 24-stellige Kennung aus einem Bezeichner. */
function kennung(bezeichner) {
  return createHash('sha256').update(bezeichner).digest('hex').slice(0, 24).toUpperCase();
}

/** Sammelt Dateien unterhalb eines Verzeichnisses. */
function sammle(verzeichnis, treffer = []) {
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (eintrag.name.startsWith('.')) continue;
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      // Asset-Kataloge sind ein einzelnes Bündel, keine Ordnerstruktur.
      if (eintrag.name.endsWith('.xcassets')) treffer.push(pfad);
      else sammle(pfad, treffer);
    } else if (eintrag.name.endsWith('.swift')) {
      treffer.push(pfad);
    }
  }
  return treffer;
}

const quellordner = join(WURZEL, PROJEKT);
const alleDateien = sammle(quellordner).map((pfad) => ({
  absolut: pfad,
  relativ: relative(WURZEL, pfad).split('/').join('/'),
  name: pfad.split('/').pop(),
  istRessource: pfad.endsWith('.xcassets'),
}));

const quellen = alleDateien.filter((d) => !d.istRessource);
const ressourcen = alleDateien.filter((d) => d.istRessource);

if (quellen.length === 0) throw new Error('Keine Swift-Dateien gefunden.');

// --------------------------------------------------------------- Serialisierung

const EINFACH = /^[A-Za-z0-9_.\/]+$/;

function wert(text) {
  if (typeof text !== 'string') return String(text);
  if (text === '') return '""';
  return EINFACH.test(text) ? text : `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function einstellungen(paare, einzug) {
  return Object.entries(paare)
    .map(([schluessel, w]) => {
      if (Array.isArray(w)) {
        const zeilen = w.map((eintrag) => `${einzug}\t\t${wert(eintrag)},`).join('\n');
        return `${einzug}\t${schluessel} = (\n${zeilen}\n${einzug}\t);`;
      }
      return `${einzug}\t${schluessel} = ${wert(w)};`;
    })
    .join('\n');
}

// --------------------------------------------------------------- Objektbaum

const idProjekt = kennung('projekt');
const idHauptgruppe = kennung('gruppe:root');
const idProdukteGruppe = kennung('gruppe:products');
const idZiel = kennung('ziel:app');
const idProdukt = kennung('produkt:app');
const idSources = kennung('phase:sources');
const idFrameworks = kennung('phase:frameworks');
const idResources = kennung('phase:resources');
const idProjektKonfigListe = kennung('konfigliste:projekt');
const idZielKonfigListe = kennung('konfigliste:ziel');
const idProjektDebug = kennung('konfig:projekt:debug');
const idProjektRelease = kennung('konfig:projekt:release');
const idZielDebug = kennung('konfig:ziel:debug');
const idZielRelease = kennung('konfig:ziel:release');

const dateiRef = (d) => kennung(`fileref:${d.relativ}`);
const buildRef = (d) => kennung(`buildfile:${d.relativ}`);

/** Baut die Gruppenstruktur aus den Verzeichnispfaden. */
function baueGruppen() {
  const wurzel = { name: PROJEKT, pfad: PROJEKT, kinder: new Map(), dateien: [] };

  for (const datei of alleDateien) {
    const teile = datei.relativ.split('/');
    teile.shift(); // Projektordner
    const dateiname = teile.pop();
    let knoten = wurzel;
    for (const teil of teile) {
      if (!knoten.kinder.has(teil)) {
        knoten.kinder.set(teil, { name: teil, pfad: teil, kinder: new Map(), dateien: [] });
      }
      knoten = knoten.kinder.get(teil);
    }
    knoten.dateien.push({ ...datei, name: dateiname });
  }
  return wurzel;
}

const gruppenbaum = baueGruppen();
const gruppenObjekte = [];

function gruppenId(pfad) {
  return kennung(`gruppe:${pfad}`);
}

function schreibeGruppe(knoten, vollerPfad) {
  const kindIds = [];
  for (const kind of knoten.kinder.values()) {
    const kindPfad = `${vollerPfad}/${kind.name}`;
    schreibeGruppe(kind, kindPfad);
    kindIds.push(`${gruppenId(kindPfad)} /* ${kind.name} */`);
  }
  for (const datei of knoten.dateien.sort((a, b) => a.name.localeCompare(b.name))) {
    kindIds.push(`${dateiRef(datei)} /* ${datei.name} */`);
  }

  gruppenObjekte.push(
    `\t\t${gruppenId(vollerPfad)} /* ${knoten.name} */ = {\n` +
      `\t\t\tisa = PBXGroup;\n` +
      `\t\t\tchildren = (\n${kindIds.map((z) => `\t\t\t\t${z},`).join('\n')}\n\t\t\t);\n` +
      `\t\t\tpath = ${wert(knoten.pfad)};\n` +
      `\t\t\tsourceTree = "<group>";\n\t\t};`
  );
}

schreibeGruppe(gruppenbaum, PROJEKT);

// --------------------------------------------------------------- Abschnitte

const buildFiles = alleDateien
  .map((d) => {
    const bereich = d.istRessource ? 'Resources' : 'Sources';
    return `\t\t${buildRef(d)} /* ${d.name} in ${bereich} */ = {isa = PBXBuildFile; fileRef = ${dateiRef(d)} /* ${d.name} */; };`;
  })
  .join('\n');

const dateiTyp = (d) => (d.istRessource ? 'folder.assetcatalog' : 'sourcecode.swift');

const fileRefs = [
  `\t\t${idProdukt} /* ${PROJEKT}.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ${PROJEKT}.app; sourceTree = BUILT_PRODUCTS_DIR; };`,
  ...alleDateien.map(
    (d) =>
      `\t\t${dateiRef(d)} /* ${d.name} */ = {isa = PBXFileReference; lastKnownFileType = ${dateiTyp(d)}; path = ${wert(d.name)}; sourceTree = "<group>"; };`
  ),
].join('\n');

const projektEinstellungenBasis = {
  ALWAYS_SEARCH_USER_PATHS: 'NO',
  CLANG_ENABLE_MODULES: 'YES',
  CLANG_ENABLE_OBJC_ARC: 'YES',
  CLANG_WARN_DOCUMENTATION_COMMENTS: 'YES',
  COPY_PHASE_STRIP: 'NO',
  ENABLE_STRICT_OBJC_MSGSEND: 'YES',
  GCC_C_LANGUAGE_STANDARD: 'gnu17',
  IPHONEOS_DEPLOYMENT_TARGET: IOS_ZIEL,
  SDKROOT: 'iphoneos',
  SWIFT_VERSION: '5.0',
};

const projektDebug = {
  ...projektEinstellungenBasis,
  DEBUG_INFORMATION_FORMAT: 'dwarf',
  ENABLE_TESTABILITY: 'YES',
  GCC_OPTIMIZATION_LEVEL: '0',
  GCC_PREPROCESSOR_DEFINITIONS: ['DEBUG=1', '$(inherited)'],
  MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE',
  ONLY_ACTIVE_ARCH: 'YES',
  SWIFT_ACTIVE_COMPILATION_CONDITIONS: 'DEBUG',
  SWIFT_OPTIMIZATION_LEVEL: '-Onone',
};

const projektRelease = {
  ...projektEinstellungenBasis,
  DEBUG_INFORMATION_FORMAT: 'dwarf-with-dsym',
  ENABLE_NS_ASSERTIONS: 'NO',
  MTL_ENABLE_DEBUG_INFO: 'NO',
  SWIFT_COMPILATION_MODE: 'wholemodule',
  VALIDATE_PRODUCT: 'YES',
};

const zielEinstellungen = {
  ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
  ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: 'AccentColor',
  CODE_SIGN_STYLE: 'Automatic',
  CURRENT_PROJECT_VERSION: '1',
  DEVELOPMENT_ASSET_PATHS: '',
  ENABLE_PREVIEWS: 'YES',
  GENERATE_INFOPLIST_FILE: 'YES',
  INFOPLIST_KEY_CFBundleDisplayName: 'Nebenkosten',
  INFOPLIST_KEY_LSApplicationCategoryType: 'public.app-category.finance',
  INFOPLIST_KEY_UIApplicationSceneManifest_Generation: 'YES',
  INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents: 'YES',
  INFOPLIST_KEY_UILaunchScreen_Generation: 'YES',
  INFOPLIST_KEY_UIRequiresFullScreen: 'NO',
  INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad:
    'UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight',
  INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone:
    'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight',
  IPHONEOS_DEPLOYMENT_TARGET: IOS_ZIEL,
  LD_RUNPATH_SEARCH_PATHS: ['$(inherited)', '@executable_path/Frameworks'],
  MARKETING_VERSION: '1.0',
  PRODUCT_BUNDLE_IDENTIFIER: BUNDLE_ID,
  PRODUCT_NAME: '$(TARGET_NAME)',
  SWIFT_EMIT_LOC_STRINGS: 'YES',
  TARGETED_DEVICE_FAMILY: '1,2',
};

const abschnitt = (name, inhalt) =>
  inhalt.trim() ? `\n/* Begin ${name} section */\n${inhalt}\n/* End ${name} section */\n` : '';

const inhalt =
  `// !$*UTF8*$!\n{\n` +
  `\tarchiveVersion = 1;\n\tclasses = {\n\t};\n\tobjectVersion = 56;\n\tobjects = {\n` +
  abschnitt('PBXBuildFile', buildFiles) +
  abschnitt('PBXFileReference', fileRefs) +
  abschnitt(
    'PBXFrameworksBuildPhase',
    `\t\t${idFrameworks} /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`
  ) +
  abschnitt(
    'PBXGroup',
    [
      `\t\t${idHauptgruppe} = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n` +
        `\t\t\t\t${gruppenId(PROJEKT)} /* ${PROJEKT} */,\n` +
        `\t\t\t\t${idProdukteGruppe} /* Products */,\n` +
        `\t\t\t);\n\t\t\tsourceTree = "<group>";\n\t\t};`,
      `\t\t${idProdukteGruppe} /* Products */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n` +
        `\t\t\t\t${idProdukt} /* ${PROJEKT}.app */,\n\t\t\t);\n\t\t\tname = Products;\n\t\t\tsourceTree = "<group>";\n\t\t};`,
      ...gruppenObjekte,
    ].join('\n')
  ) +
  abschnitt(
    'PBXNativeTarget',
    `\t\t${idZiel} /* ${PROJEKT} */ = {\n` +
      `\t\t\tisa = PBXNativeTarget;\n` +
      `\t\t\tbuildConfigurationList = ${idZielKonfigListe} /* Build configuration list for PBXNativeTarget "${PROJEKT}" */;\n` +
      `\t\t\tbuildPhases = (\n\t\t\t\t${idSources} /* Sources */,\n\t\t\t\t${idFrameworks} /* Frameworks */,\n\t\t\t\t${idResources} /* Resources */,\n\t\t\t);\n` +
      `\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t);\n` +
      `\t\t\tname = ${PROJEKT};\n\t\t\tproductName = ${PROJEKT};\n` +
      `\t\t\tproductReference = ${idProdukt} /* ${PROJEKT}.app */;\n` +
      `\t\t\tproductType = "com.apple.product-type.application";\n\t\t};`
  ) +
  abschnitt(
    'PBXProject',
    `\t\t${idProjekt} /* Project object */ = {\n` +
      `\t\t\tisa = PBXProject;\n` +
      `\t\t\tattributes = {\n\t\t\t\tBuildIndependentTargetsInParallel = 1;\n\t\t\t\tLastSwiftUpdateCheck = 1600;\n\t\t\t\tLastUpgradeCheck = 1600;\n` +
      `\t\t\t\tTargetAttributes = {\n\t\t\t\t\t${idZiel} = {\n\t\t\t\t\t\tCreatedOnToolsVersion = 16.0;\n\t\t\t\t\t};\n\t\t\t\t};\n\t\t\t};\n` +
      `\t\t\tbuildConfigurationList = ${idProjektKonfigListe} /* Build configuration list for PBXProject "${PROJEKT}" */;\n` +
      `\t\t\tcompatibilityVersion = "Xcode 14.0";\n\t\t\tdevelopmentRegion = de;\n\t\t\thasScannedForEncodings = 0;\n` +
      `\t\t\tknownRegions = (\n\t\t\t\tde,\n\t\t\t\ten,\n\t\t\t\tBase,\n\t\t\t);\n` +
      `\t\t\tmainGroup = ${idHauptgruppe};\n\t\t\tproductRefGroup = ${idProdukteGruppe} /* Products */;\n` +
      `\t\t\tprojectDirPath = "";\n\t\t\tprojectRoot = "";\n` +
      `\t\t\ttargets = (\n\t\t\t\t${idZiel} /* ${PROJEKT} */,\n\t\t\t);\n\t\t};`
  ) +
  abschnitt(
    'PBXResourcesBuildPhase',
    `\t\t${idResources} /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n` +
      ressourcen.map((d) => `\t\t\t\t${buildRef(d)} /* ${d.name} in Resources */,`).join('\n') +
      `\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`
  ) +
  abschnitt(
    'PBXSourcesBuildPhase',
    `\t\t${idSources} /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n` +
      quellen.map((d) => `\t\t\t\t${buildRef(d)} /* ${d.name} in Sources */,`).join('\n') +
      `\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`
  ) +
  abschnitt(
    'XCBuildConfiguration',
    [
      [idProjektDebug, 'Debug', projektDebug],
      [idProjektRelease, 'Release', projektRelease],
      [idZielDebug, 'Debug', zielEinstellungen],
      [idZielRelease, 'Release', zielEinstellungen],
    ]
      .map(
        ([id, name, werte]) =>
          `\t\t${id} /* ${name} */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n${einstellungen(werte, '\t\t\t')}\n\t\t\t};\n\t\t\tname = ${name};\n\t\t};`
      )
      .join('\n')
  ) +
  abschnitt(
    'XCConfigurationList',
    [
      `\t\t${idProjektKonfigListe} /* Build configuration list for PBXProject "${PROJEKT}" */ = {\n` +
        `\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t${idProjektDebug} /* Debug */,\n\t\t\t\t${idProjektRelease} /* Release */,\n\t\t\t);\n` +
        `\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t};`,
      `\t\t${idZielKonfigListe} /* Build configuration list for PBXNativeTarget "${PROJEKT}" */ = {\n` +
        `\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t${idZielDebug} /* Debug */,\n\t\t\t\t${idZielRelease} /* Release */,\n\t\t\t);\n` +
        `\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t};`,
    ].join('\n')
  ) +
  `\t};\n\trootObject = ${idProjekt} /* Project object */;\n}\n`;

mkdirSync(ZIEL, { recursive: true });
writeFileSync(join(ZIEL, 'project.pbxproj'), inhalt);

// Arbeitsbereich, damit Xcode das Projekt direkt öffnen kann
mkdirSync(join(ZIEL, 'project.xcworkspace'), { recursive: true });
writeFileSync(
  join(ZIEL, 'project.xcworkspace', 'contents.xcworkspacedata'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<Workspace\n   version = "1.0">\n   <FileRef\n      location = "self:">\n   </FileRef>\n</Workspace>\n`
);

console.log(`${relative(process.cwd(), join(ZIEL, 'project.pbxproj'))} erzeugt`);
console.log(`  ${quellen.length} Swift-Dateien, ${ressourcen.length} Ressource(n)`);
