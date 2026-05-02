/**
 * data/avatars.ts
 * ────────────────
 * Avatar categories and URLs — moved out of constants.ts.
 */

export interface Avatar {
  name: string;
  url: string;
}

export interface AvatarCategory {
  id: string;
  name: string;
  avatars: Avatar[];
}

const gd = (id: string) => `https://lh3.googleusercontent.com/d/${id}`;

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: 'bridgerton',
    name: 'Bridgerton',
    avatars: [
      { name: 'Anthony Bridgerton',     url: gd('1KzRtMnyHwlJYwjr09S3UjhLtEg51W-Lr') },
      { name: 'Benedict Bridgerton',    url: gd('1YlWDXxAhiKlc6r641vEVqTqFsXobC__-') },
      { name: 'Colin Bridgerton',       url: gd('1ay24h5pSUfQ339nf1yvYtuMVLsY-L_r5') },
      { name: 'Daphne Basset',          url: gd('1iloFbK5eBE0JwAYsyEyZEYMahIaWLiZL') },
      { name: 'Eloise Bridgerton',      url: gd('1eNNCBDTROwaoishIx9_fkx8YFucs12NE') },
      { name: 'Francesca Bridgerton',   url: gd('1Ocb11OmSHJlRfzT6w97e_yuCp0B1X3EC') },
      { name: 'Kathani Bridgerton',     url: gd('1QgeRATcBSnH8prA5S3Hqnxm3VwB7YB9G') },
      { name: 'Lady Danbury',           url: gd('1qOo2XsRjVZsZQWUdLUJpHwuGEBRYlPQX') },
      { name: 'Penelope Featherington', url: gd('1Z__4y8VugluuVFwRdqG6eKaxwuy5rzc6') },
      { name: 'Queen Charlotte',        url: gd('1Bvp9-Q7K6KqKxxxOz4l75ksVsJ4NhYmR') },
      { name: 'Simon Basset',           url: gd('1bMUWIh4lqfpSrf5ifpdZ29GKC-gFCtJH') },
      { name: 'Sophie Baek',            url: gd('1PVt6TyXP55YMM9c5tJNXev9Lsw1mDBlF') },
      { name: 'Violet Bridgerton',      url: gd('1CIWh6dWbYek4Z7tLQVXkHEzBdN54xVFu') },
    ],
  },
  {
    id: 'one-piece',
    name: 'One Piece',
    avatars: [
      { name: 'Monkey D. Luffy', url: gd('1CCWWd9W3ODzxAn1lJ6TsKRYyAxdLxeq8') },
      { name: 'Zoro',            url: gd('1HqM0dZKFN99eJw015CWCeZxpqix3EgT0') },
      { name: 'Nami',            url: gd('1zqX1Q-0BIrG0taII5kqsL_zRNt1oVYE6') },
      { name: 'Sanji',           url: gd('1ZL2FXFwrOjAiHuOXZ0SUu2gXZy3Jw3ts') },
      { name: 'Chopper',         url: gd('1yZOQdzM_MPyWOpMgjqfd0S73KIoDAjLl') },
      { name: 'Usopp',           url: gd('1T63TmoapNx9DLbTrOUWtu93XpqZkhQM5') },
      { name: 'Arlong',          url: gd('1bUqGSDkhtgw1FtXZJqD5flQ-AMYjrBxa') },
      { name: 'Alvida',          url: gd('1kRyzph--pyxtTGjEU35nt1GDPz70fMrU') },
      { name: 'Shanks',          url: gd('1Sr0hpD0rTFJyyBbCWoKC0x6oD-rke-pU') },
      { name: 'Going Merry',     url: gd('1my31WNqaaUo5v34oK08r_3o30Yvc6GAf') },
      { name: 'Jolly Roger',     url: gd('18n1qSVxKIFQwX308WEsHC78-SlnSTRBu') },
    ],
  },
  {
    id: 'peaky-blinders',
    name: 'Peaky Blinders',
    avatars: [
      { name: 'Tommy Shelby',  url: gd('1wW1ox6Uc1g368rqZ5CAphVSH84KW711n') },
      { name: 'Duke',          url: gd('1lv3S6zkHP2cj7x1_z1Xas6cwN86bsrb-') },
      { name: 'Hayden Stagg',  url: gd('1abCdQHYZ4A6thk6WvT0LMs7fgNVoXo1b') },
      { name: 'John Beckett',  url: gd('1fMP16GVuLI_YE58zqgzokzrTrhCoN3cW') },
      { name: 'Kaulo Chiriklo',url: gd('1e1jV3_MfCKrv25cEy-y14HxVD3ChdJtT') },
    ],
  },
  {
    id: 'lucifer',
    name: 'Lucifer',
    avatars: [
      { name: 'Lucifer Morningstar', url: gd('1vuBOiPd9DknqbZpUXgMUEAUwZiGee52g') },
      { name: 'Chloe Decker',        url: gd('1KtbqNziC8SxPDUJfMS2NGKhoaKaPUdos') },
      { name: 'Mazikeen',            url: gd('1hygVLyg-7PsCkE1fdRByTje4OmgE7773') },
      { name: 'Amenadiel',           url: gd('1dfWobx2-vWsArr2lQeZ_guWI2ZPvMQNo') },
    ],
  },
  {
    id: 'classics',
    name: 'P-Stream Classics',
    avatars: [
      { name: 'Blue Fluffball',     url: gd('1i3UrprAcfhKSNaSwFE1FXwTD6NXOfjaV') },
      { name: 'Gray Fluffball',     url: gd('1gKlTO0SLMJzk0RUqihW7n4ovugEZj9Jf') },
      { name: 'Orange Fluffball',   url: gd('1I-MhzW-S8sQkJ72QOKQelNHnas41VWkn') },
      { name: 'Bubblegum Princess', url: gd('1ltTBpxXy_QxWDIJyyJHSYtwRemSb_fYb') },
      { name: 'Green Alien',        url: gd('1_shb0mnchPaWk-F9anvInjBBRbGXJF7Z') },
      { name: 'Panda Face',         url: gd('1MOcMHPqN0hFbkpoqjdirZl4jgI5VFVqo') },
      { name: 'Red Anger',          url: gd('198aosLkzeCyglhaKy5vPMeWktSJhFui_') },
      { name: 'Yellow Chicken',     url: gd('1ZYyoo8gUHeugXIa5ciA6pJySe3OPdkNB') },
    ],
  },
];

export const ALL_AVATARS = AVATAR_CATEGORIES.flatMap(c => c.avatars.map(a => a.url));
export const DEFAULT_AVATAR = ALL_AVATARS[0];
