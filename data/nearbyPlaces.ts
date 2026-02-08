export interface NearbyPlace {
  name: string;
  address: string;
  distance: string;
}

export interface BuildingNearby {
  coffee: NearbyPlace;
  restaurant: NearbyPlace;
  bar: NearbyPlace;
}

export const nearbyPlaces: Record<string, BuildingNearby> = {
  // 1. Luminary Austin - 400 W 14th St (Clarksville / West End)
  "luminary-austin": {
    coffee: {
      name: "Houndstooth Coffee",
      address: "401 Congress Ave",
      distance: "0.5 miles",
    },
    restaurant: {
      name: "Jeffrey's",
      address: "1204 West Lynn St",
      distance: "0.4 miles",
    },
    bar: {
      name: "Small Victory",
      address: "108 E 7th St",
      distance: "0.7 miles",
    },
  },

  // 2. The Modern Austin - 610 Davis St (near West Ave / Seaholm)
  "the-modern-austin": {
    coffee: {
      name: "Merit Coffee",
      address: "222 West Ave",
      distance: "0.1 miles",
    },
    restaurant: {
      name: "Clark's Oyster Bar",
      address: "1200 West 6th St",
      distance: "0.4 miles",
    },
    bar: {
      name: "The Roosevelt Room",
      address: "307 W 5th St",
      distance: "0.4 miles",
    },
  },

  // 3. 44 East Avenue - 44 East Ave (near East Ave / Rainey area)
  "44-east-avenue": {
    coffee: {
      name: "Cenote",
      address: "1010 E Cesar Chavez St",
      distance: "0.5 miles",
    },
    restaurant: {
      name: "Emmer & Rye",
      address: "51 Rainey St",
      distance: "0.2 miles",
    },
    bar: {
      name: "Container Bar",
      address: "90 Rainey St",
      distance: "0.2 miles",
    },
  },

  // 4. The Independent - 301 West Ave (West Ave corridor)
  "the-independent": {
    coffee: {
      name: "Jo's Coffee",
      address: "242 W 2nd St",
      distance: "0.2 miles",
    },
    restaurant: {
      name: "Wu Chow",
      address: "500 W 5th St",
      distance: "0.3 miles",
    },
    bar: {
      name: "Half Step",
      address: "75 Rainey St",
      distance: "0.5 miles",
    },
  },

  // 5. Seaholm Residences - 222 West Ave (Seaholm District)
  "seaholm-residences": {
    coffee: {
      name: "Merit Coffee",
      address: "222 West Ave",
      distance: "1 min walk",
    },
    restaurant: {
      name: "Juniper",
      address: "2400 E Cesar Chavez St",
      distance: "0.8 miles",
    },
    bar: {
      name: "Garage Bar",
      address: "503 Colorado St",
      distance: "0.3 miles",
    },
  },

  // 6. 70 Rainey - 70 Rainey St (Rainey Street District)
  "70-rainey": {
    coffee: {
      name: "Figure 8 Coffee",
      address: "1111 Chicon St",
      distance: "0.6 miles",
    },
    restaurant: {
      name: "Emmer & Rye",
      address: "51 Rainey St",
      distance: "1 min walk",
    },
    bar: {
      name: "Banger's Sausage House & Beer Garden",
      address: "79 Rainey St",
      distance: "1 min walk",
    },
  },

  // 7. Austin Proper Residences - 202 Nueces St (2nd Street District)
  "austin-proper-residences": {
    coffee: {
      name: "Jo's Coffee",
      address: "242 W 2nd St",
      distance: "0.1 miles",
    },
    restaurant: {
      name: "Vince Young Steakhouse",
      address: "301 San Jacinto Blvd",
      distance: "0.2 miles",
    },
    bar: {
      name: "The Roosevelt Room",
      address: "307 W 5th St",
      distance: "0.3 miles",
    },
  },

  // 8. 5th and West - 501 West Ave (West Ave corridor)
  "5th-and-west": {
    coffee: {
      name: "Spokesman",
      address: "1531 Airport Blvd",
      distance: "0.9 miles",
    },
    restaurant: {
      name: "Clark's Oyster Bar",
      address: "1200 W 6th St",
      distance: "0.3 miles",
    },
    bar: {
      name: "Firehouse Lounge",
      address: "605 Brazos St",
      distance: "0.4 miles",
    },
  },

  // 9. Four Seasons Residences - 98 San Jacinto Blvd (Lady Bird Lake / Congress)
  "four-seasons-residences": {
    coffee: {
      name: "Alfred",
      address: "206 W 4th St",
      distance: "0.3 miles",
    },
    restaurant: {
      name: "1886 Cafe & Bakery",
      address: "604 Brazos St",
      distance: "0.3 miles",
    },
    bar: {
      name: "Midnight Cowboy",
      address: "313 E 6th St",
      distance: "0.4 miles",
    },
  },

  // 10. The W Residences - 210 Lavaca St (2nd Street District)
  "the-w-residences": {
    coffee: {
      name: "Jo's Coffee",
      address: "242 W 2nd St",
      distance: "2 min walk",
    },
    restaurant: {
      name: "Wu Chow",
      address: "500 W 5th St",
      distance: "0.3 miles",
    },
    bar: {
      name: "Garage Bar",
      address: "503 Colorado St",
      distance: "0.2 miles",
    },
  },

  // 11. The Austonian - 200 Congress Ave (Congress Ave / 2nd Street)
  "the-austonian": {
    coffee: {
      name: "Houndstooth Coffee",
      address: "401 Congress Ave",
      distance: "0.1 miles",
    },
    restaurant: {
      name: "Vince Young Steakhouse",
      address: "301 San Jacinto Blvd",
      distance: "0.2 miles",
    },
    bar: {
      name: "Firehouse Lounge",
      address: "605 Brazos St",
      distance: "0.3 miles",
    },
  },

  // 12. 360 Condominiums - 360 Nueces St (West End / 4th Street)
  "360-condominiums": {
    coffee: {
      name: "Medici Roasting",
      address: "200 Congress Ave",
      distance: "0.3 miles",
    },
    restaurant: {
      name: "Wu Chow",
      address: "500 W 5th St",
      distance: "0.2 miles",
    },
    bar: {
      name: "The Roosevelt Room",
      address: "307 W 5th St",
      distance: "2 min walk",
    },
  },

  // 13. The Shore Condominiums - 603 Davis St (near West Ave / Seaholm)
  "the-shore-condominiums": {
    coffee: {
      name: "Merit Coffee",
      address: "222 West Ave",
      distance: "0.1 miles",
    },
    restaurant: {
      name: "Odd Duck",
      address: "1201 S Lamar Blvd",
      distance: "0.9 miles",
    },
    bar: {
      name: "Half Step",
      address: "75 Rainey St",
      distance: "0.6 miles",
    },
  },

  // 14. Austin City Lofts - 800 W 5th St (West End)
  "austin-city-lofts": {
    coffee: {
      name: "Civil Goat Coffee",
      address: "510 Oakland Ave",
      distance: "0.5 miles",
    },
    restaurant: {
      name: "Clark's Oyster Bar",
      address: "1200 W 6th St",
      distance: "0.2 miles",
    },
    bar: {
      name: "Small Victory",
      address: "108 E 7th St",
      distance: "0.6 miles",
    },
  },

  // 15. Spring Condominiums - 300 Bowie St (Seaholm / 3rd Street)
  "spring-condominiums": {
    coffee: {
      name: "Jo's Coffee",
      address: "242 W 2nd St",
      distance: "0.2 miles",
    },
    restaurant: {
      name: "TLC Austin",
      address: "1100 S Lamar Blvd",
      distance: "0.7 miles",
    },
    bar: {
      name: "Garage Bar",
      address: "503 Colorado St",
      distance: "0.2 miles",
    },
  },

  // 16. Milago - 54 Rainey St (Rainey Street District)
  "milago": {
    coffee: {
      name: "Cenote",
      address: "1010 E Cesar Chavez St",
      distance: "0.4 miles",
    },
    restaurant: {
      name: "Emmer & Rye",
      address: "51 Rainey St",
      distance: "1 min walk",
    },
    bar: {
      name: "Craft Pride",
      address: "61 Rainey St",
      distance: "1 min walk",
    },
  },

  // 17. The Towers of Town Lake - 40 N IH-35 (East Cesar Chavez / Lady Bird Lake)
  "the-towers-of-town-lake": {
    coffee: {
      name: "Figure 8 Coffee",
      address: "1111 Chicon St",
      distance: "0.5 miles",
    },
    restaurant: {
      name: "Suerte",
      address: "1800 E 6th St",
      distance: "0.6 miles",
    },
    bar: {
      name: "Whisler's",
      address: "1816 E 6th St",
      distance: "0.6 miles",
    },
  },

  // 18. Cambridge Tower - 1801 Lavaca St (North downtown / Capitol area)
  "cambridge-tower": {
    coffee: {
      name: "Seventh Flag Coffee",
      address: "1117 W 6th St",
      distance: "0.5 miles",
    },
    restaurant: {
      name: "Dai Due",
      address: "2406 Manor Rd",
      distance: "0.9 miles",
    },
    bar: {
      name: "Midnight Cowboy",
      address: "313 E 6th St",
      distance: "0.6 miles",
    },
  },

  // 19. Brazos Lofts - 411 Brazos St (East 4th / CBD)
  "brazos-lofts": {
    coffee: {
      name: "Houndstooth Coffee",
      address: "401 Congress Ave",
      distance: "2 min walk",
    },
    restaurant: {
      name: "1886 Cafe & Bakery",
      address: "604 Brazos St",
      distance: "0.1 miles",
    },
    bar: {
      name: "Midnight Cowboy",
      address: "313 E 6th St",
      distance: "0.2 miles",
    },
  },

  // 20. Sabine on 5th - 507 Sabine St (East 5th / Waller Creek)
  "sabine-on-5th": {
    coffee: {
      name: "Alfred",
      address: "206 W 4th St",
      distance: "0.4 miles",
    },
    restaurant: {
      name: "Suerte",
      address: "1800 E 6th St",
      distance: "0.5 miles",
    },
    bar: {
      name: "Here Nor There",
      address: "412 E 6th St",
      distance: "0.2 miles",
    },
  },

  // 21. The Laan - 3100 Menchaca Rd (South Lamar / Zilker area)
  "the-laan": {
    coffee: {
      name: "Fleet Coffee",
      address: "2427 Webberville Rd",
      distance: "0.8 miles",
    },
    restaurant: {
      name: "Odd Duck",
      address: "1201 S Lamar Blvd",
      distance: "0.4 miles",
    },
    bar: {
      name: "Hotel San Jose Bar",
      address: "1316 S Congress Ave",
      distance: "0.6 miles",
    },
  },

  // 22. 904 West - 904 West Ave (West Ave / 9th St)
  "904-west": {
    coffee: {
      name: "Medici Roasting",
      address: "1101 W Lynn St",
      distance: "0.3 miles",
    },
    restaurant: {
      name: "Sway",
      address: "1417 S 1st St",
      distance: "0.9 miles",
    },
    bar: {
      name: "Small Victory",
      address: "108 E 7th St",
      distance: "0.5 miles",
    },
  },

  // 23. Celia's Court - 908 Nueces St (West End / 9th St)
  "celias-court": {
    coffee: {
      name: "Civil Goat Coffee",
      address: "510 Oakland Ave",
      distance: "0.4 miles",
    },
    restaurant: {
      name: "Clark's Oyster Bar",
      address: "1200 W 6th St",
      distance: "0.3 miles",
    },
    bar: {
      name: "Firehouse Lounge",
      address: "605 Brazos St",
      distance: "0.5 miles",
    },
  },

  // 24. 6th and Brushy - 601 Brushy St (East 6th)
  "6th-and-brushy": {
    coffee: {
      name: "Figure 8 Coffee",
      address: "1111 Chicon St",
      distance: "0.3 miles",
    },
    restaurant: {
      name: "Launderette",
      address: "2115 Holly St",
      distance: "0.5 miles",
    },
    bar: {
      name: "Whisler's",
      address: "1816 E 6th St",
      distance: "0.4 miles",
    },
  },

  // 25. Brazos Place - 800 Brazos St (CBD / East 8th)
  "brazos-place": {
    coffee: {
      name: "Houndstooth Coffee",
      address: "401 Congress Ave",
      distance: "0.3 miles",
    },
    restaurant: {
      name: "Dai Due",
      address: "2406 Manor Rd",
      distance: "0.8 miles",
    },
    bar: {
      name: "Here Nor There",
      address: "412 E 6th St",
      distance: "0.2 miles",
    },
  },

  // 26. 5 Fifty Five - 555 E 5th St (East downtown / Convention Center)
  "5-fifty-five": {
    coffee: {
      name: "Cenote",
      address: "1010 E Cesar Chavez St",
      distance: "0.3 miles",
    },
    restaurant: {
      name: "Juliet",
      address: "1500 Barton Springs Rd",
      distance: "0.7 miles",
    },
    bar: {
      name: "Container Bar",
      address: "90 Rainey St",
      distance: "0.3 miles",
    },
  },

  // 27. Nokonah - 901 W 9th St (Clarksville / Shoal Creek)
  "nokonah": {
    coffee: {
      name: "Civil Goat Coffee",
      address: "510 Oakland Ave",
      distance: "0.3 miles",
    },
    restaurant: {
      name: "Jeffrey's",
      address: "1204 West Lynn St",
      distance: "0.4 miles",
    },
    bar: {
      name: "The Roosevelt Room",
      address: "307 W 5th St",
      distance: "0.5 miles",
    },
  },

  // 28. The Hillside - 8110 Ranch Rd 2222 (NW Austin hills)
  "the-hillside": {
    coffee: {
      name: "Summer Moon Coffee",
      address: "3115 N Lamar Blvd",
      distance: "0.8 miles",
    },
    restaurant: {
      name: "Uchiko",
      address: "4200 N Lamar Blvd",
      distance: "0.6 miles",
    },
    bar: {
      name: "Loro",
      address: "2115 S Lamar Blvd",
      distance: "3.5 miles",
    },
  },
};
