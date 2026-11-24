import type { Caption, Choice, Scenario, SourceRef } from '../types.ts'

/**
 * "Ankara 1402: The Sultan's Choice" — vertical slice.
 *
 * Editorial rules:
 *  - Outcomes with kind 'historical' follow the documented course of events; where historians
 *    disagree, the text says so.
 *  - Outcomes with kind 'fictional' are speculation and are labelled everywhere in the UI.
 *  - Territories are a schematic of who dominated a region, NOT historical borders.
 *  - Sources are works for further reading on the period. They are not quoted and no page-level
 *    citations are claimed.
 */

const SOURCES: Record<string, SourceRef> = {
  manz: { id: 'manz', kind: 'scholarship', label: 'Beatrice Forbes Manz, The Rise and Rule of Tamerlane (Cambridge University Press, 1989)' },
  imber: { id: 'imber', kind: 'scholarship', label: 'Colin Imber, The Ottoman Empire, 1300–1650: The Structure of Power (Palgrave Macmillan, 2002)' },
  finkel: { id: 'finkel', kind: 'scholarship', label: 'Caroline Finkel, Osman’s Dream: The History of the Ottoman Empire (John Murray, 2005)' },
  kastritsis: { id: 'kastritsis', kind: 'scholarship', label: 'Dimitris J. Kastritsis, The Sons of Bayezid: Empire Building and Representation in the Ottoman Civil War of 1402–13 (Brill, 2007)' },
  nicol: { id: 'nicol', kind: 'scholarship', label: 'Donald M. Nicol, The Last Centuries of Byzantium, 1261–1453 (Cambridge University Press, 2nd ed., 1993)' },
  runciman: { id: 'runciman', kind: 'scholarship', label: 'Steven Runciman, The Fall of Constantinople 1453 (Cambridge University Press, 1965)' },
  crowley: { id: 'crowley', kind: 'scholarship', label: 'Roger Crowley, 1453: The Holy War for Constantinople and the Clash of Islam and the West (Hyperion, 2005)' },
  clavijo: { id: 'clavijo', kind: 'chronicle', label: 'Ruy González de Clavijo, Embassy to Tamerlane 1403–1406 (eyewitness travel account; English translation by Guy Le Strange, 1928)' },
  yazdi: { id: 'yazdi', kind: 'chronicle', label: 'Sharaf al-Dīn ʿAlī Yazdī, Zafarnama (court chronicle of Timur; favourable to its patron)' },
}

const cap = (from: number, to: number, text: string): Caption => ({ from, to, text })

const FICTION_NOTE = 'Alternate-history fiction: this outcome did not happen.'

const choices = {
  fight: {
    id: 'fight',
    label: 'Give battle at Ankara',
    summary: 'Bayezid commits his army against Timur’s on the plain north-east of Ankara.',
    historical: true,
    effects: [
      { type: 'control', territory: 'anatolia-central', to: 'timurid' },
      { type: 'control', territory: 'anatolia-west', to: 'timurid' },
      { type: 'control', territory: 'anatolia-east', to: 'timurid' },
      { type: 'control', territory: 'beyliks', to: 'beylik' },
      { type: 'stat', stat: 'ottomanPower', delta: -55 },
      { type: 'stat', stat: 'timuridReach', delta: 25 },
      { type: 'stat', stat: 'byzantineSecurity', delta: 35 },
      { type: 'stat', stat: 'stability', delta: -30 },
      { type: 'flag', flag: 'bayezidCaptured' },
    ],
    outcome: {
      title: 'The Sultan is taken',
      kind: 'historical',
      visual: 'Two armies meet on open ground; a block of Anatolian troops changes colour mid-battle and the Ottoman line breaks.',
      immediate: [
        'Bayezid I is captured and dies in captivity in 1403.',
        'Troops from the Anatolian principalities that Bayezid had annexed are reported to have gone over to Timur during the battle.',
        'Timur’s forces plunder western Anatolia and take Smyrna (Izmir) from the Knights Hospitaller in December 1402.',
      ],
      longTerm: [
        'Timur restores the Anatolian principalities that Bayezid had annexed.',
        'Bayezid’s sons fight a civil war (the Ottoman Interregnum, 1402–1413).',
        'Constantinople is relieved for half a century. Timur himself dies in 1405 on the way to campaign against China.',
      ],
      context:
        'This is what happened. The later story that Timur kept Bayezid in an iron cage is doubted by many historians and is not reliably documented. Casualty numbers in the sources are uncertain, and the extent to which the Anatolian defections decided the battle is debated.',
      sources: ['manz', 'imber', 'finkel', 'clavijo', 'yazdi'],
      endYear: 1403,
      cinematic: {
        template: 'battle',
        terrain: 'steppe',
        seed: 1402,
        duration: 24,
        a: { faction: 'timurid', count: 130, label: 'Timur’s army' },
        b: { faction: 'ottoman', count: 110, label: 'Bayezid’s army' },
        defect: { count: 36, toFaction: 'timurid', atP: 0.34, label: 'Anatolian contingents' },
        result: 'a',
        captureLeader: true,
        captions: [
          cap(0, 0.2, '28 July 1402. Timur’s army and the Sultan’s army meet near Ankara.'),
          cap(0.2, 0.44, 'Anatolian contingents in Bayezid’s ranks go over to Timur, according to the chroniclers.'),
          cap(0.44, 0.72, 'The Ottoman line breaks under the assault.'),
          cap(0.72, 1, 'Bayezid is taken prisoner. He will die in captivity in 1403.'),
        ],
      },
    },
    next: [{ goto: 'succession' }],
  },
  withdraw: {
    id: 'withdraw',
    label: 'Withdraw to Rumelia and avoid battle',
    summary: 'Bayezid abandons Anatolia to Timur and crosses to Europe with his army intact.',
    historical: false,
    effects: [
      { type: 'control', territory: 'anatolia-central', to: 'timurid' },
      { type: 'control', territory: 'anatolia-west', to: 'timurid' },
      { type: 'control', territory: 'anatolia-east', to: 'timurid' },
      { type: 'control', territory: 'beyliks', to: 'beylik' },
      { type: 'stat', stat: 'ottomanPower', delta: -20 },
      { type: 'stat', stat: 'timuridReach', delta: 20 },
      { type: 'stat', stat: 'byzantineSecurity', delta: -5 },
      { type: 'stat', stat: 'stability', delta: -10 },
      { type: 'flag', flag: 'armyIntact' },
      { type: 'flag', flag: 'sultanFree' },
    ],
    outcome: {
      title: 'The army that was not spent',
      kind: 'fictional',
      visual: 'The Ottoman army halts facing Timur, then turns about and marches west, intact.',
      immediate: [
        'Timur holds Anatolia and restores the principalities, as he did in reality.',
        'Bayezid keeps a large army and his European provinces.',
        'The blockade of Constantinople has not been broken by defeat.',
      ],
      longTerm: [
        'No civil war among Bayezid’s sons is triggered by his capture.',
        'The Ottoman state would likely recover faster, with unpredictable consequences for its neighbours.',
      ],
      context:
        'Fiction. In reality Bayezid fought, and was captured. Whether he could have crossed the straits with his army intact, and whether Timur would have let him, is unknowable. ' + FICTION_NOTE,
      sources: ['manz', 'imber'],
      endYear: 1403,
      cinematic: {
        template: 'battle',
        terrain: 'steppe',
        seed: 1403,
        duration: 18,
        a: { faction: 'timurid', count: 130, label: 'Timur’s army' },
        b: { faction: 'ottoman', count: 110, label: 'Bayezid’s army' },
        result: 'b-withdraws',
        captions: [
          cap(0, 0.28, 'Fiction. The two armies close on each other near Ankara.'),
          cap(0.28, 0.55, 'Bayezid weighs the odds and refuses battle.'),
          cap(0.55, 1, 'The Ottoman army withdraws toward the straits, intact. Anatolia lies open to Timur.'),
        ],
      },
    },
    next: [{ goto: 'siege-choice' }],
  },
  concede: {
    id: 'concede',
    label: 'Accept Timur’s terms',
    summary: 'Bayezid returns the annexed principalities and sends away the rulers whom Timur wants back.',
    historical: false,
    effects: [
      { type: 'control', territory: 'beyliks', to: 'beylik' },
      { type: 'stat', stat: 'ottomanPower', delta: -15 },
      { type: 'stat', stat: 'timuridReach', delta: 15 },
      { type: 'stat', stat: 'stability', delta: -10 },
      { type: 'flag', flag: 'armyIntact' },
      { type: 'flag', flag: 'sultanFree' },
    ],
    outcome: {
      title: 'The humbled Thunderbolt',
      kind: 'fictional',
      visual: 'Envoys from both camps meet between the armies; Timur’s army then turns away.',
      immediate: [
        'The Anatolian principalities are restored without a battle.',
        'Bayezid keeps his army and the Ottoman core in Anatolia and Rumelia.',
      ],
      longTerm: [
        'Bayezid’s prestige is badly damaged at home, but his realm and his sons’ inheritance are not shattered.',
        'Whether Timur would have accepted such terms is uncertain.',
      ],
      context:
        'Fiction. Historians describe a dispute that involved Timur’s demands over the principalities and over refugee rulers sheltering with Bayezid; the exchange of letters between the two rulers was hostile. ' + FICTION_NOTE,
      sources: ['manz', 'finkel'],
      endYear: 1403,
      cinematic: {
        template: 'parley',
        terrain: 'steppe',
        seed: 1404,
        duration: 16,
        a: { faction: 'timurid', count: 70, label: 'Timurid envoys and escort' },
        b: { faction: 'ottoman', count: 60, label: 'Ottoman envoys and escort' },
        result: 'agreement',
        captions: [
          cap(0, 0.35, 'Fiction. Envoys ride out between the two camps.'),
          cap(0.35, 0.7, 'Bayezid agrees to Timur’s demands.'),
          cap(0.7, 1, 'Timur’s army turns away. The war is over before it began.'),
        ],
      },
    },
    next: [{ goto: 'siege-choice' }],
  },
  mehmed: {
    id: 'mehmed',
    label: 'Mehmed Çelebi prevails (1413)',
    summary: 'Bayezid’s son Mehmed defeats his brother Musa and reunites the Ottoman realm.',
    historical: true,
    effects: [
      { type: 'control', territory: 'anatolia-central', to: 'ottoman' },
      { type: 'control', territory: 'anatolia-west', to: 'ottoman' },
      { type: 'control', territory: 'anatolia-east', to: 'ottoman' },
      { type: 'control', territory: 'rumelia', to: 'ottoman' },
      { type: 'stat', stat: 'ottomanPower', delta: 35 },
      { type: 'stat', stat: 'stability', delta: 30 },
      { type: 'stat', stat: 'byzantineSecurity', delta: 5 },
      { type: 'flag', flag: 'reunified' },
      { type: 'flag', flag: 'friendlyToByzantium' },
    ],
    outcome: {
      title: 'The realm is made whole',
      kind: 'historical',
      visual: 'Two Ottoman armies meet on open ground; the army from Anatolia carries the field.',
      immediate: [
        'Mehmed I becomes sole ruler of the Ottoman realm in 1413.',
        'Relations with Byzantium are comparatively calm during his reign.',
      ],
      longTerm: [
        'The Ottoman state recovers over the following decades.',
        'In 1453 his grandson Mehmed II takes Constantinople.',
      ],
      context:
        'This is what happened. Mehmed’s success is usually explained by a mix of military ability and alliances, including support from Byzantium and Serbia; the detail of these alliances is debated in the scholarship.',
      sources: ['kastritsis', 'imber', 'nicol'],
      endYear: 1413,
      cinematic: {
        template: 'battle',
        terrain: 'plain',
        seed: 1413,
        duration: 18,
        a: { faction: 'ottoman', count: 110, label: 'Mehmed’s army (Anatolia)' },
        b: { faction: 'rumelian', count: 100, label: 'Musa’s army (Rumelia)' },
        result: 'a',
        captions: [
          cap(0, 0.25, '1413. Two sons of Bayezid fight for the whole realm.'),
          cap(0.25, 0.62, 'The armies clash.'),
          cap(0.62, 1, 'Mehmed’s army carries the field. The civil war is over.'),
        ],
      },
    },
    next: [{ goto: 'walls-1453' }],
  },
  suleyman: {
    id: 'suleyman',
    label: 'Süleyman Çelebi holds Edirne and wins',
    summary: 'The prince who made peace with Byzantium in 1403 defeats his brothers.',
    historical: false,
    effects: [
      { type: 'control', territory: 'anatolia-central', to: 'ottoman' },
      { type: 'control', territory: 'anatolia-west', to: 'ottoman' },
      { type: 'control', territory: 'anatolia-east', to: 'ottoman' },
      { type: 'control', territory: 'rumelia', to: 'ottoman' },
      { type: 'stat', stat: 'ottomanPower', delta: 30 },
      { type: 'stat', stat: 'stability', delta: 20 },
      { type: 'stat', stat: 'byzantineSecurity', delta: 15 },
      { type: 'flag', flag: 'reunified' },
      { type: 'flag', flag: 'westwardState' },
    ],
    outcome: {
      title: 'A sultan in Edirne',
      kind: 'fictional',
      visual: 'The army from Rumelia carries the field against the army from Anatolia.',
      immediate: [
        'Süleyman reunifies the realm from Edirne, with his power base in the Balkans.',
        'The 1403 arrangements with Byzantium and its Western partners continue.',
      ],
      longTerm: [
        'A more Balkan-centred Ottoman state, with warmer relations to Constantinople, is imaginable.',
        'Whether this would have delayed or prevented the later fall of the city is not knowable.',
      ],
      context:
        'Fiction. In reality Süleyman made a treaty with Byzantium and several Western powers in 1403 but was killed in 1411 in the civil war. ' + FICTION_NOTE,
      sources: ['kastritsis', 'nicol'],
      endYear: 1413,
      cinematic: {
        template: 'battle',
        terrain: 'plain',
        seed: 1411,
        duration: 18,
        a: { faction: 'rumelian', count: 110, label: 'Süleyman’s army (Rumelia)' },
        b: { faction: 'ottoman', count: 100, label: 'Mehmed’s army (Anatolia)' },
        result: 'a',
        captions: [
          cap(0, 0.25, 'Fiction. Süleyman faces his brother Mehmed.'),
          cap(0.25, 0.62, 'The armies clash.'),
          cap(0.62, 1, 'Süleyman holds the field and the realm.'),
        ],
      },
    },
    next: [{ goto: 'walls-1453' }],
  },
  musa: {
    id: 'musa',
    label: 'Musa Çelebi defeats his brothers',
    summary: 'The prince who besieged Constantinople in 1411 wins the civil war.',
    historical: false,
    effects: [
      { type: 'control', territory: 'anatolia-central', to: 'ottoman' },
      { type: 'control', territory: 'anatolia-west', to: 'ottoman' },
      { type: 'control', territory: 'anatolia-east', to: 'ottoman' },
      { type: 'control', territory: 'rumelia', to: 'ottoman' },
      { type: 'stat', stat: 'ottomanPower', delta: 35 },
      { type: 'stat', stat: 'stability', delta: 15 },
      { type: 'stat', stat: 'byzantineSecurity', delta: -25 },
      { type: 'flag', flag: 'reunified' },
      { type: 'flag', flag: 'hostileToByzantium' },
    ],
    outcome: {
      title: 'The hostile sultan',
      kind: 'fictional',
      visual: 'The army from Rumelia, led by Musa, carries the field against the army from Anatolia.',
      immediate: [
        'Musa reunifies the realm. In reality he is reported to have attacked Byzantine territory and besieged Constantinople in 1411.',
        'Byzantine hopes of peace with the Ottomans collapse.',
      ],
      longTerm: [
        'A hostile Ottoman ruler could leave Byzantium weaker and more isolated in the decades that followed.',
      ],
      context:
        'Fiction. In reality Musa was defeated and killed in 1413. ' + FICTION_NOTE,
      sources: ['kastritsis', 'nicol'],
      endYear: 1413,
      cinematic: {
        template: 'battle',
        terrain: 'plain',
        seed: 1412,
        duration: 18,
        a: { faction: 'rumelian', count: 110, label: 'Musa’s army (Rumelia)' },
        b: { faction: 'ottoman', count: 100, label: 'Mehmed’s army (Anatolia)' },
        result: 'a',
        captions: [
          cap(0, 0.25, 'Fiction. Musa meets Mehmed in the decisive battle.'),
          cap(0.25, 0.62, 'The armies clash.'),
          cap(0.62, 1, 'Musa holds the field. Constantinople has little reason to hope for peace.'),
        ],
      },
    },
    next: [{ goto: 'walls-1453' }],
  },
  wallsFall: {
    id: 'walls-fall',
    label: 'The defence breaks',
    summary: 'Giustiniani is wounded and leaves his post. The attackers pour through the breach.',
    historical: true,
    effects: [
      { type: 'control', territory: 'constantinople', to: 'ottoman' },
      { type: 'stat', stat: 'byzantineSecurity', delta: -100 },
      { type: 'stat', stat: 'ottomanPower', delta: 20 },
      { type: 'flag', flag: 'constantinopleFallen' },
    ],
    outcome: {
      title: 'The City falls',
      kind: 'historical',
      visual: 'A cannon batters the land walls; the defenders’ commander falls and the wall is breached.',
      immediate: [
        'Constantinople falls on 29 May 1453 and the last Byzantine emperor, Constantine XI, dies in the fighting.',
        'The Genoese commander Giovanni Giustiniani Longo is wounded during the final assault and withdrawn; sources differ on exactly how much this affected the defenders.',
      ],
      longTerm: [
        'The city becomes the Ottoman capital, later called Istanbul.',
        'Byzantine scholars and refugees continue to migrate to Italy, as they had been doing for decades.',
      ],
      context:
        'This is what happened. Reports of the final assault differ in detail, including the role of an unlocked small gate and the timing of Giustiniani’s wound.',
      sources: ['runciman', 'nicol', 'crowley'],
      endYear: 1453,
      cinematic: {
        template: 'siege',
        terrain: 'coast',
        seed: 1453,
        duration: 24,
        a: { faction: 'ottoman', count: 150, label: 'Ottoman assault' },
        b: { faction: 'byzantine', count: 56, label: 'Defenders of the walls' },
        result: 'falls',
        commanderFalls: true,
        captions: [
          cap(0, 0.28, '29 May 1453. The final assault on the land walls begins.'),
          cap(0.28, 0.56, 'Ottoman guns hammer the wall.'),
          cap(0.56, 0.78, 'The Genoese commander is wounded and leaves his post (reported). The wall is breached.'),
          cap(0.78, 1, 'The defence collapses. Constantine XI dies in the fighting.'),
        ],
      },
    },
    next: [{ goto: null }],
  },
  wallsHold: {
    id: 'walls-hold',
    label: 'The walls hold',
    summary: 'The commander keeps his post; the assault is repulsed.',
    historical: false,
    requires: { stat: { id: 'byzantineSecurity', min: 55 } },
    lockedReason: 'In this timeline Byzantium is too weak and isolated to sustain such a defence.',
    effects: [
      { type: 'stat', stat: 'byzantineSecurity', delta: 15 },
      { type: 'stat', stat: 'ottomanPower', delta: -10 },
      { type: 'flag', flag: 'constantinopleHeld' },
    ],
    outcome: {
      title: 'One more night',
      kind: 'fictional',
      visual: 'The same assault breaks against an unbroken wall; the attackers fall back.',
      immediate: [
        'The assault of 29 May 1453 fails. The Ottoman army withdraws from the wall.',
        'The defenders have survived the day, but they are few and exhausted.',
      ],
      longTerm: [
        'The Ottomans might renew the siege. A defence this strong would still depend on help from outside.',
      ],
      context:
        'Fiction. In reality the defence broke. Even a failed assault would not have solved Byzantium’s fundamental weakness: a very small population and no major relief force. ' + FICTION_NOTE,
      sources: ['runciman', 'nicol'],
      endYear: 1453,
      cinematic: {
        template: 'siege',
        terrain: 'coast',
        seed: 1454,
        duration: 20,
        a: { faction: 'ottoman', count: 150, label: 'Ottoman assault' },
        b: { faction: 'byzantine', count: 56, label: 'Defenders of the walls' },
        result: 'holds',
        captions: [
          cap(0, 0.28, 'Fiction. The final assault begins as it did in 1453.'),
          cap(0.28, 0.58, 'The commander keeps his post and the wall stands.'),
          cap(0.58, 1, 'The attackers fall back. The City lives to see another dawn.'),
        ],
      },
    },
    next: [{ goto: null }],
  },
  surrenderTerms: {
    id: 'terms',
    label: 'Accept Mehmed’s terms',
    summary: 'The emperor yields the City in return for safety for its people.',
    historical: false,
    effects: [
      { type: 'control', territory: 'constantinople', to: 'ottoman' },
      { type: 'stat', stat: 'byzantineSecurity', delta: -60 },
      { type: 'stat', stat: 'stability', delta: 10 },
      { type: 'flag', flag: 'constantinopleSurrendered' },
    ],
    outcome: {
      title: 'The gates are opened',
      kind: 'fictional',
      visual: 'Envoys meet outside the walls; the Ottoman army camps in peace and the gates open.',
      immediate: [
        'The City passes to Ottoman rule without the final assault.',
        'Its inhabitants are spared the sack that followed the real assault.',
      ],
      longTerm: [
        'Byzantine institutions might survive longer in some form, but political independence ends.',
      ],
      context:
        'Fiction. Some accounts say Mehmed II offered terms before the assault and Constantine XI refused. ' + FICTION_NOTE,
      sources: ['runciman', 'crowley'],
      endYear: 1453,
      cinematic: {
        template: 'parley',
        terrain: 'coast',
        seed: 1455,
        duration: 16,
        a: { faction: 'ottoman', count: 80, label: 'Ottoman envoys and escort' },
        b: { faction: 'byzantine', count: 50, label: 'Byzantine envoys and escort' },
        result: 'agreement',
        captions: [
          cap(0, 0.35, 'Fiction. Envoys meet outside the land walls.'),
          cap(0.35, 0.7, 'Constantine XI accepts the sultan’s terms.'),
          cap(0.7, 1, 'The Ottoman army withdraws from the wall. The gates open to a new ruler.'),
        ],
      },
    },
    next: [{ goto: null }],
  },
  resume: {
    id: 'resume',
    label: 'Resume the blockade and storm the City',
    summary: 'Bayezid turns his intact army on Constantinople.',
    historical: false,
    effects: [
      { type: 'control', territory: 'constantinople', to: 'ottoman' },
      { type: 'stat', stat: 'byzantineSecurity', delta: -100 },
      { type: 'stat', stat: 'ottomanPower', delta: 10 },
      { type: 'flag', flag: 'constantinopleFallen' },
    ],
    outcome: {
      title: 'The City falls early',
      kind: 'fictional',
      visual: 'An Ottoman assault breaks through the land walls of an isolated Constantinople.',
      immediate: [
        'In this timeline Constantinople falls around 1403, half a century before it did in reality.',
        'Emperor Manuel II is still abroad seeking help in the West.',
      ],
      longTerm: [
        'Ottoman power would consolidate in the Balkans and Anatolia earlier.',
        'The long Byzantine twilight, and the scholars who left for Italy during it, would have unfolded differently.',
      ],
      context:
        'Fiction. In reality Ankara lifted the blockade and Byzantium survived until 1453. Bayezid had been blockading the City since the 1390s and had not taken it. ' + FICTION_NOTE,
      sources: ['nicol', 'imber'],
      endYear: 1404,
      cinematic: {
        template: 'siege',
        terrain: 'coast',
        seed: 1403,
        duration: 22,
        a: { faction: 'ottoman', count: 150, label: 'Bayezid’s assault' },
        b: { faction: 'byzantine', count: 44, label: 'Defenders of the walls' },
        result: 'falls',
        commanderFalls: true,
        captions: [
          cap(0, 0.28, 'Fiction. Bayezid’s army, unbroken by Ankara, storms the land walls.'),
          cap(0.28, 0.58, 'The garrison is far too small.'),
          cap(0.58, 1, 'The walls are breached and the City falls.'),
        ],
      },
    },
    next: [{ goto: null }],
  },
  lift: {
    id: 'lift',
    label: 'Lift the blockade and make peace',
    summary: 'Bayezid accepts a settlement with the Byzantine court.',
    historical: false,
    effects: [
      { type: 'stat', stat: 'byzantineSecurity', delta: 25 },
      { type: 'flag', flag: 'peaceWithByzantium' },
    ],
    outcome: {
      title: 'A truce at the walls',
      kind: 'fictional',
      visual: 'Envoys meet at the gates; the besieging army withdraws.',
      immediate: [
        'The blockade that had lasted years is ended by agreement.',
        'Constantinople remains Byzantine and survives under Ottoman pressure.',
      ],
      longTerm: [
        'The fate of the City would depend on later rulers; the truce itself would not be permanent.',
      ],
      context:
        'Fiction. In reality, in 1403 Süleyman Çelebi made a treaty with Byzantium and several Western powers that eased the pressure on Constantinople. ' + FICTION_NOTE,
      sources: ['nicol', 'kastritsis'],
      endYear: 1404,
      cinematic: {
        template: 'parley',
        terrain: 'coast',
        seed: 1406,
        duration: 16,
        a: { faction: 'ottoman', count: 80, label: 'Ottoman envoys and escort' },
        b: { faction: 'byzantine', count: 50, label: 'Byzantine envoys and escort' },
        result: 'agreement',
        captions: [
          cap(0, 0.35, 'Fiction. Envoys meet at the gates of Constantinople.'),
          cap(0.35, 0.7, 'Terms are agreed.'),
          cap(0.7, 1, 'The besieging army marches away. The City is spared for now.'),
        ],
      },
    },
    next: [{ goto: null }],
  },
} satisfies Record<string, Choice>

export const ANKARA_1402: Scenario = {
  id: 'ankara-1402',
  title: 'Ankara 1402: The Sultan’s Choice',
  tagline: 'One battle decided the fate of two empires.',
  premise:
    'In July 1402 Timur, ruler of a Central Asian empire centred on Samarkand, confronts the Ottoman Sultan Bayezid I near Ankara. Take command at each turning point, change what you wish, and watch the consequences unfold.',
  startYear: 1402,
  start: 'ankara',
  initialStats: { ottomanPower: 80, timuridReach: 40, byzantineSecurity: 20, stability: 60 },
  initialControl: {
    rumelia: 'ottoman',
    'anatolia-west': 'ottoman',
    'anatolia-central': 'ottoman',
    'anatolia-east': 'ottoman',
    beyliks: 'ottoman',
    constantinople: 'byzantine',
    'timurid-core': 'timurid',
  },
  territories: [
    { id: 'rumelia', name: 'Rumelia (Ottoman Balkans)', lat: 42.2, lng: 25.0, radius: 5.6, initial: 'ottoman', note: 'Ottoman possessions in the Balkans, governed from Edirne.' },
    { id: 'anatolia-west', name: 'Western Anatolia', lat: 38.9, lng: 29.4, radius: 3.4, initial: 'ottoman', note: 'Ottoman heartland, including Bursa.' },
    { id: 'anatolia-central', name: 'Central Anatolia', lat: 40.0, lng: 33.2, radius: 3.0, initial: 'ottoman', note: 'The region around Ankara.' },
    { id: 'anatolia-east', name: 'Eastern Anatolia', lat: 39.6, lng: 37.6, radius: 3.0, initial: 'ottoman', note: 'The region around Sivas, taken by Bayezid in the 1390s.' },
    { id: 'beyliks', name: 'Southern Anatolian principalities', lat: 37.2, lng: 32.0, radius: 3.2, initial: 'ottoman', note: 'Former independent beyliks (such as Karaman) annexed by Bayezid in the 1390s.' },
    { id: 'constantinople', name: 'Constantinople', lat: 41.01, lng: 28.98, radius: 1.1, initial: 'byzantine', note: 'The Byzantine capital, blockaded by Bayezid for years.' },
    { id: 'timurid-core', name: 'Timurid heartland', lat: 39.6, lng: 66.9, radius: 13, initial: 'timurid', note: 'Timur’s empire, ruled from Samarkand.' },
  ],
  sites: [
    { id: 'ankara', name: 'Ankara', lat: 39.93, lng: 32.86, blurb: 'Timur besieged the city and met Bayezid’s army nearby on 28 July 1402.' },
    { id: 'constantinople', name: 'Constantinople', lat: 41.01, lng: 28.98, blurb: 'The Byzantine capital. Ankara lifted the Ottoman blockade. In 1453 it fell to Mehmed II.' },
    { id: 'edirne', name: 'Edirne (Adrianople)', lat: 41.68, lng: 26.56, blurb: 'The Ottoman capital in Europe, held by Süleyman after Ankara.' },
    { id: 'bursa', name: 'Bursa', lat: 40.19, lng: 29.06, blurb: 'An early Ottoman capital in Anatolia, plundered after the battle.' },
    { id: 'sivas', name: 'Sivas', lat: 39.75, lng: 37.02, blurb: 'Taken by Timur in 1400 before his move on Ankara.' },
    { id: 'samarkand', name: 'Samarkand', lat: 39.65, lng: 66.96, blurb: 'Timur’s capital, in present-day Uzbekistan.' },
  ],
  anchors: [
    { year: 1402, label: 'Ankara' },
    { year: 1403, label: 'Bayezid dies; treaty with Byzantium' },
    { year: 1405, label: 'Timur dies' },
    { year: 1413, label: 'Mehmed I reunites the realm' },
    { year: 1453, label: 'Fall of Constantinople' },
  ],
  sources: SOURCES,
  nodes: {
    ankara: {
      id: 'ankara',
      title: 'The Battle of Ankara',
      dateLabel: '28 July 1402',
      year: 1402,
      siteId: 'ankara',
      situation:
        'Timur has marched into Anatolia and besieged Ankara. Bayezid I, called Yıldırım (“Thunderbolt”), has lifted his blockade of Constantinople and marched his army east in summer heat. Many of his troops come from Anatolian principalities he annexed in the 1390s, whose former rulers are in Timur’s camp.',
      question: 'What does Bayezid do?',
      choices: [choices.fight, choices.withdraw, choices.concede],
    },
    succession: {
      id: 'succession',
      title: 'The Ottoman Interregnum',
      dateLabel: '1403–1413',
      year: 1413,
      siteId: 'edirne',
      situation:
        'Bayezid dies in captivity in 1403. His sons, Süleyman in Edirne, İsa, Mehmed in the north of Anatolia, and Musa, fight over the realm. In 1403 Süleyman has already made a treaty with Byzantium and Western powers that eases the pressure on Constantinople.',
      question: 'Which prince reunites the Ottoman state?',
      choices: [choices.mehmed, choices.suleyman, choices.musa],
    },
    'siege-choice': {
      id: 'siege-choice',
      title: 'The blockade of Constantinople',
      dateLabel: '1403',
      year: 1403,
      siteId: 'constantinople',
      situation:
        'Bayezid is free and his army is intact, but Timur dominates Anatolia. Constantinople has been under Ottoman blockade for years. Emperor Manuel II is in the West seeking help; his nephew John VII governs the City.',
      question: 'Does Bayezid resume the assault on Constantinople?',
      choices: [choices.resume, choices.lift],
    },
    'walls-1453': {
      id: 'walls-1453',
      title: 'The Walls of Constantinople',
      dateLabel: '29 May 1453',
      year: 1453,
      siteId: 'constantinople',
      situation:
        'Forty years later, Mehmed II besieges Constantinople. The garrison is a few thousand men against many times their number; the Theodosian Walls are battered by Ottoman cannon. The decisive assault begins before dawn.',
      variants: [
        { flag: 'friendlyToByzantium', text: 'Under the Ottoman rulers since 1413, relations with the Byzantine court have been relatively calm.' },
        { flag: 'westwardState', text: 'In this timeline the 1403 treaty era has endured, and Constantinople has had decades of relative respite.' },
        { flag: 'hostileToByzantium', text: 'In this timeline Musa’s hostility has left Byzantium wary, isolated and badly short of allies.' },
      ],
      question: 'How does the final assault end?',
      choices: [choices.wallsFall, choices.wallsHold, choices.surrenderTerms],
    },
  },
}

export const SCENARIO_SOURCES = SOURCES
