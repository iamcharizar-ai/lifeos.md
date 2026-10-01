// Which body position pictures each skill. Every id in data/skills/*.json must
// appear here — `npm run validate` fails otherwise, so new skills can't ship
// without a picture.
const S = {
  // Physical Foundations
  'joint-prep-wrists': 'catCow', 'scapular-control': 'hangActive', 'hollow-arch-basics': 'hollow', 'compression-foundation': 'vSit',
  // Horizontal Push
  'assisted-pushup': 'pushupKnee', 'pushup': 'pushup', 'decline-pushup': 'pushupDec', 'diamond-pushup': 'pushupDown',
  'archer-pushup': 'pushupWide', 'bicep-pushup': 'pushupDown', 'oap-eccentric': 'pushupOne', 'one-arm-pushup': 'pushupOne',
  'dip': 'dipBottom', 'weighted-dip': 'dipWeight', 'support-hold': 'dipTop', 'straight-bar-dip': 'muscleUp',
  'elbow-lever': 'elbowLever', 'planche-lean': 'plancheLean', 'frog-stand-to-tuck': 'frogStand', 'planche-lean-pushup': 'plancheLeanBent',
  'pseudo-pushup': 'plancheLeanBent', 'tuck-planche': 'tuckPlanche', 'planche-program-8wk': 'plancheLean', 'tuck-planche-pushup': 'tuckPlanche',
  'adv-tuck-planche': 'advTuck', 'adv-tuck-planche-pushup': 'advTuck', 'straddle-planche': 'strPlanche', 'ninety-deg-hold': 'pushupDown',
  'ninety-deg-pushup': 'pushupDown', 'full-planche': 'fullPlanche', 'planche-pushup': 'plancheDown', 'wide-pushup': 'pushupWide',
  'uneven-pushup': 'pushupOne', 'spiderman-pushup': 'pushupDown', 'scorpion-pushup': 'pushupOne', 'tigerbend-pushup': 'pikeUp',
  'hindu-pushup': 'pike', 'dive-bomber-pushup': 'pike', 'straddle-planche-pushup': 'plancheDown', 'bench-dip': 'dipBench',
  'bulgarian-dip': 'dipBottom', 'chest-dip': 'dipBottom', 'archer-dip': 'dipBottom', 'rto-support-hold': 'dipTop',
  'rto-dip': 'dipBottom', 'korean-dip': 'dipBench', 'elbow-dip': 'dipBottom', 'russian-dip': 'dipBottom',
  'impossible-dip': 'dipBottom', 'frog-planche': 'frogStand', 'piked-straddle-planche': 'strPlanche', 'half-lay-planche': 'fullPlanche',
  'wide-grip-planche': 'fullPlanche', 'iron-cross-fly': 'ringsCross', 'straight-arm-rto-dip': 'ringsCross', 'iron-cross': 'ringsCross',
  'maltese': 'ringsPlanche', 'pelican-curl': 'tuckPlanche', 'hefesto': 'fullPlanche',
  // Vertical Push
  'pike-pushup': 'pike', 'elevated-pike-pushup': 'pikeUp', 'crow-pose': 'crow', 'assisted-handstand': 'handstandWall',
  'wall-handstand': 'handstandWall', 'wall-line-drill': 'handstandWall', 'handstand-bail': 'kickUp', 'toe-pulls': 'handstand',
  'freestanding-kickups': 'kickUp', 'handstand-shape': 'handstand', 'handstand': 'handstand', 'assisted-hspu': 'handstandBent',
  'hspu': 'handstandBent', 'freestanding-hspu': 'handstandBent', 'press-to-handstand': 'pressHS', 'one-arm-handstand': 'handstandOne',
  'shoulder-stand': 'shoulderStand', 'headstand': 'headstand', 'forearm-stand': 'forearmStand', 'close-grip-pike-pushup': 'pike',
  'close-grip-hspu': 'handstandBent', 'tigerbend-hspu': 'handstandBent', 'hspu-90': 'handstandBent',
  // Vertical Pull
  'dead-hang': 'hangDead', 'active-hang': 'hangActive', 'german-hang': 'hangGerman', 'skin-the-cat': 'skinCat',
  'rope-climb': 'ropeClimb', 'hanging-leg-raise': 'legRaise', 'toes-to-bar': 'toesBar', 'scapula-pullup': 'hangActive',
  'assisted-pullup': 'pullMid', 'pullup': 'pullTop', 'chin-up': 'pullTop', 'chest-pullup': 'pullTop',
  'archer-pullup': 'archerPull', 'weighted-pullup': 'pullWeight', 'explosive-pullup-chest': 'pullTop', 'waist-pullup': 'muscleUpTrans',
  'pullover': 'toesBar', 'false-grip-transition': 'muscleUpTrans', 'banded-muscle-up-transition': 'muscleUpTrans', 'muscle-up-negative': 'muscleUpTrans',
  'muscle-up': 'muscleUp', 'strict-muscle-up': 'muscleUp', 'oap-negative': 'pullOne', 'one-arm-pullup': 'pullOne',
  'dead-hang-human-flag': 'flagDead', 'tuck-human-flag': 'flagTuck', 'straddle-human-flag': 'flagStrad', 'human-flag': 'humanFlag',
  'headbangers': 'pullTop', 'typewriter-pullup': 'archerPull', 'oac-negative': 'pullOne', 'one-arm-chinup': 'pullOne',
  // Bar Dynamics
  'bar-swing': 'barSwing', 'swing-regrip': 'barSwing', 'monkey-bar-traverse': 'monkeyBars', 'lache': 'lache', 'bar-kip': 'toesBar',
  'back-hip-circle': 'hipCircle', 'underswing-dismount': 'lache', 'bar-180': 'barSpin', 'pull-180': 'barSpin', 'pull-360': 'barSpin',
  'swing-360': 'barSpin', 'bar-540': 'barSpin', 'bar-720': 'barSpin', 'muscle-up-360': 'barSpin', 'alley-oop': 'barSpin',
  'baby-giant': 'giant', 'giant': 'giant', 'shrimp-flip': 'flyaway', 'flyaway': 'flyaway', 'front-flyaway': 'flyaway', 'geinger': 'flyaway',
  // Horizontal Pull
  'assisted-inverted-row': 'row', 'inverted-row': 'row', 'bulgarian-row': 'rowTop', 'one-arm-inverted-row': 'rowTop',
  'tuck-fl': 'flTuck', 'front-lever-raises-tuck': 'flTuck', 'tuck-fl-row': 'flTuck', 'single-leg-tuck-fl': 'flOne',
  'adv-single-leg-tuck-fl': 'flOne', 'adv-tuck-fl-row': 'flAdv', 'front-lever-negatives': 'flAdv', 'piked-straddle-front-lever': 'flStrad',
  'straddle-fl': 'flStrad', 'half-lay-front-lever': 'flFull', 'straddle-fl-row': 'flPull', 'full-fl': 'flFull',
  'full-fl-row': 'flPull', 'fl-pullup': 'flPull', 'victorian-cross': 'flCross', 'back-lever-skin-cat-volume': 'skinCat',
  'tuck-bl': 'blTuck', 'adv-tuck-bl': 'blAdv', 'frog-back-lever': 'blTuck', 'piked-straddle-back-lever': 'blStrad',
  'straddle-bl': 'blStrad', 'half-lay-back-lever': 'blFull', 'full-bl': 'blFull',
  // Core
  'situp': 'sitUp', 'plank': 'plank', 'hollow-body': 'hollow', 'v-up': 'vUp', 'lsit-compression': 'lSit', 'tucked-lsit': 'tuckLSit',
  'lsit': 'lSit', 'straddle-sit': 'strSit', 'tucked-vsit': 'tuckLSit', 'v-sit': 'vSit', 'tucked-manna': 'tuckLSit', 'manna': 'manna',
  'side-plank': 'sidePlank', 'tucked-dragon-flag': 'dragonTuck', 'one-leg-dragon-flag': 'dragon', 'straddle-dragon-flag': 'dragonStrad',
  'dragon-flag': 'dragon', 'windshield-wipers': 'wipers', 'ab-rollout': 'rollout',
  // Legs
  'bw-squat': 'squat', 'ankle-mobility-squat': 'ankleWall', 'split-squat': 'lunge', 'single-leg-balance': 'balance',
  'nordic-anchor-setup': 'nordicNeg', 'cossack-squat': 'cossack', 'sissy-squat': 'sissy', 'hawaiian-squat': 'deepSquat',
  'shrimp-squat': 'shrimp', 'pistol-box-negative': 'pistol', 'pistol-squat': 'pistol', 'dragon-squat': 'shrimp',
  'makarov-squat': 'shrimp', 'sideways-dragon-pistol-squat': 'pistol', 'lunge': 'lunge', 'calf-raise': 'calfRaise',
  'single-leg-calf-raise': 'calfRaise', 'tib-raise': 'calfRaise', 'reverse-nordic-curl': 'revNordic', 'nordic-negative': 'nordicNeg',
  'nordic-curl': 'nordic',
  // Mobility Foundations
  'active-flexibility-basics': 'seatedFold', 'shoulder-flexion': 'shoulderUp', 'thoracic-extension': 'thoracic', 'hip-rotation': 'hipRotate',
  'ankle-dorsiflexion': 'ankleWall', 'cat-cow': 'catCow', 'shoulder-mobility-drills': 'dislocate', 'shoulder-dislocates': 'dislocate',
  'deep-squat-hold': 'deepSquat',
  // Flexibility
  'touching-toes': 'foldFwd', 'plow-pose': 'plow', 'pigeon-stretch': 'pigeon', 'hamstring-loaded-pike': 'seatedFold',
  'pike-compression-stretch': 'seatedFold', 'pancake': 'pancake', 'middle-split-strength': 'splitMid', 'middle-split': 'splitMid',
  'front-split-strength': 'lunge', 'front-split': 'splitFront', 'standing-split': 'splitStand', 'leg-behind-neck': 'legNeck',
  'camel-pose': 'camel', 'bridge-prep': 'bridge', 'bridge-wheel': 'wheel', 'lotus-prep': 'lotus', 'lotus': 'lotus',
  // Arm Balances
  'wrist-loading-yoga': 'catCow', 'hip-compression-arm-balance': 'lSit', 'twist-mobility': 'mermaid', 'one-legged-crow': 'crowLeg',
  'crow-exits': 'crow', 'crane-pose': 'crow', 'crow-to-handstand': 'kickUp', 'side-crow': 'sideCrow',
  'flying-pigeon': 'flyPigeon', 'grasshopper': 'grasshopper', 'firefly-pose': 'firefly', 'eight-angle-pose': 'eightAngle',
  'mayurasana': 'peacock', 'flying-split-balance': 'flySplit',
  // Yoga Holds
  'tree-pose': 'tree', 'warrior-ii': 'warrior2', 'chair-pose': 'chair', 'boat-pose': 'boat', 'king-dance': 'kingDancer',
  'full-king-dancer': 'kingDancer', 'mermaid-pose': 'mermaid', 'king-pigeon': 'kingPigeon', 'full-king-pigeon': 'kingPigeon',
  'scorpion-pose': 'scorpion', 'hollowback-handstand': 'handstandArch',
  // Acrobatics Foundations
  'safe-landing': 'landing', 'forward-roll': 'roll', 'backward-roll': 'rollBack', 'jump-tuck-landing': 'tuckJump',
  'cartwheel': 'cartwheel', 'handstand-cartwheel-line': 'cartwheel', 'roundoff': 'roundoff', 'kip-up': 'kipUp', 'trampoline-spotting': 'kickUp',
  // Kicks
  'round-kick': 'kickRound', 'crescent-kick': 'kickCres', 'hook-kick': 'kickHook', 'tornado-kick': 'tornado', 'pop-360': 'kick360',
  'cheat-540': 'kick540', '540-hook': 'kick540', 'pop-540': 'popKick', 'pop-720': 'popKick', 'hyperhook': 'hyperhook',
  'jackknife': 'jackknife', 'cheat-900': 'kickBig',
  // Flips & Twists
  'cartwheel-pop': 'cartwheel', 'no-handed-cartwheel': 'flipSide', 'aerial-drills': 'aerial', 'aerial': 'aerial', 'macaco': 'macaco',
  'raiz': 'macaco', 'back-handspring': 'handspring', 'backflip': 'flipBack', 'front-flip': 'flipFront', 'side-flip': 'flipSide',
  'gainer': 'flipBack', 'webster': 'webster', 'flash-kick': 'flash', 'butterfly-kick': 'butterfly', 'moon-kick': 'moon',
  'full-twist': 'fullTwist', 'corkscrew': 'corkscrew', 'b-twist': 'bTwist',
  // Breaking
  'toprock': 'toprock', 'six-step': 'sixStep', 'ccs-and-footwork': 'cc', 'freeze-basics': 'freeze', 'advanced-freeze': 'airBaby',
  'backspin': 'backspin', 'power-move-conditioning': 'pushupDown', 'swipes': 'swipe', 'windmills': 'windmill', 'halo': 'halo',
  'flare': 'flare', 'headspin': 'headspin', 'nineties': 'nineties', 'airflare': 'airFlare', 'combo-reel-30s': 'reel',
  // Dance
  'dance-musicality': 'music', 'body-wave': 'wave', 'the-worm': 'worm', 'moonwalk': 'moonwalk', 'airwalk': 'airwalk', 'glide-combo': 'glide',
}

export const SKILL_POSE = S
export const poseOf = (id) => S[id] || 'stand'
