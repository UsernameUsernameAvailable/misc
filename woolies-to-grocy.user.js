// ==UserScript==
// @name         Woolies extractor to grocy
// @namespace    http://tampermonkey.net/
// @version      2025-04-23
// @description  try to take over the world!
// @author       You
// @match        https://www.woolworths.co.nz/lists/pastorders/*
// @match        https://www.woolworths.co.nz/lists/saved/*
// @match        https://www.woolworths.co.nz/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=woolworths.co.nz
// @grant        none
// ==/UserScript==
function q(s){if(document.body){return document.body.querySelector(s);}return null;}
(function() {
    'use strict';

    const GROCY_HOST = "<YOUR HOST HERE>"; //e.g. https://grocy.example.com

    const GROCY_API_KEY = "<YOUR KEY HERE>";

    // Sample product mapping, from Woolworths to your Grocy products groups, units, locations
    const PROD_GRP_MAP = {
        "Fruit & Veg": 1,
        "Meat & Poultry": 2,
        "Fish & Seafood": 3,
        "Fridge & Deli": 4,
        "Bakery": 5,
        "Frozen": 6,
        "Pantry": 7,
        "Drinks": 8,
        "Health & Body": 9,
        "Household": 10,
        "Pet": 11,
        "Other": 12
    };

    const UNIT_MAP = {
        "Piece": 2,
        "Pack": 3,
        "Jar": 4,
        "Bottle": 5,
        "Can": 6,
        "Tube": 7,
        "Item": 8,
        "Gram": 9,
        "Kilogram": 10,
        "Litre": 11,
        "Millilitre": 12,
        "Each": 8, // hack, map Each to Item
        "L": 11,
        "Ml": 12,
        "G": 9,
        "Kg": 10
    };

    const PROD_LCN_MAP = {
        "Fruit & Veg": 2, // fridge
        "Meat & Poultry": 2, // fridge
        "Fish & Seafood": 2, // fridge
        "Fridge & Deli": 2, // fridge
        "Bakery": 4, // freezer
        "Frozen": 4, // freezer
        "Pantry": 3, // pantry
        "Drinks": 3, // pantry
        "Health & Body": 7, // bathroom
        "Household": 6, // laundry
        "Pet": 3, // pantry
        "Other": 9 // other
    };

    // locations for reference
    const REF_LOCATIONS = {
        "Fridge": 2,
        "Pantry": 3,
        "Freezer": 4,
        "Undersink": 5,
        "Laundry": 6,
        "Bathroom": 7,
        "Bedroom": 8,
        "Other": 9
    };

    function waitForElement(selector, callback) {
        const observer = new MutationObserver((mutations, me) => {
            const element = document.querySelector(selector);
            if (element) {
                me.disconnect(); // Stop observing once the element exists
                callback(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async function main() {
        waitForElement('.main[aria-busy="false"]', () => {
            renderButtons();
        });
        let saveList = q("#extract_buttons_list");
        let saveItem = q("#extract_buttons_item");
        let saveItemGeneric = q("#extract_buttons_item_generic");
        let saveItemName = q("#extract_buttons_item_name");
        saveList.disabled = true;
        saveItem.disabled = true;
        saveItemGeneric.disabled = true;
        saveItemName.disabled = true;
        saveItemName.value="";
    }

    async function renderButtons() {
        let buttons = q("#extract_buttons");
        let saveList = q("#extract_buttons_list");
        let saveItem = q("#extract_buttons_item");
        let saveItemGeneric = q("#extract_buttons_item_generic");
        let saveItemName = q("#extract_buttons_item_name");
        if (!buttons) {
            // create buttons
            buttons = document.createElement('div');
            buttons.id = 'extract_buttons';
            buttons.style= 'padding:10px; background-color:grey; color: white';
            buttons.innerHTML = "<span>Woolworths Extractor for Grocy</span>";

            saveList = document.createElement("button");
            saveList.id = "extract_buttons_list";
            saveList.style = "margin-left:10px;";
            saveList.disabled = true;
            saveList.innerHTML = "Save List";
            saveList.addEventListener('click', fetchOrder, true);
            buttons.appendChild(saveList);

            saveItem = document.createElement("button");
            saveItem.id = "extract_buttons_item";
            saveItem.style = "margin-left:10px;";
            saveItem.disabled = true;
            saveItem.innerHTML = "Save Item";
            saveItem.addEventListener('click', fetchItem, true);
            buttons.appendChild(saveItem);

            saveItemGeneric = document.createElement("button");
            saveItemGeneric.id = "extract_buttons_item_generic";
            saveItemGeneric.style = "margin-left:10px;";
            saveItemGeneric.disabled = true;
            saveItemGeneric.innerHTML = "Save Item as Name:";
            saveItemGeneric.addEventListener('click', fetchItem, true);
            buttons.appendChild(saveItemGeneric);

            saveItemName = document.createElement("input");
            saveItemName.id = "extract_buttons_item_name";
            saveItemName.style = "margin-left:10px; width:40%; max-width:none;";
            saveItemName.disabled = true;
            saveItemName.type = "text";
            buttons.appendChild(saveItemName);

            // cors test
//             let corstest = document.createElement("button");
//             corstest.id = "corstest";
//             corstest.style = "margin-left:10px;";
//             corstest.innerHTML = "corstest";
//             corstest.addEventListener('click', corstestf, true);
//             buttons.appendChild(corstest);

            document.body.prepend(buttons);
        }
        if (window.location.href.indexOf("https://www.woolworths.co.nz/lists/pastorders/") > -1 || window.location.href.indexOf("https://www.woolworths.co.nz/lists/saved/") > -1) {
            saveList.disabled = false;
            saveItem.disabled = true;
            saveItemGeneric.disabled = true;
            saveItemName.disabled = true;
            buttons.style= 'padding:10px; background-color:grey; color: white';
        } else if (window.location.href.indexOf("https://www.woolworths.co.nz/shop/productdetails") > -1) {
            //684102
            let params = new URLSearchParams(document.location.search);
            let id = params.get("stockcode");
            const response = await fetch(GROCY_HOST + "/api/objects/userfield_values_resolved?query%5B%5D=name%3Dsku&query%5B%5D=value%3D" + id,
                                         {headers: {
                                             "Accept": "application/json",
                                             "GROCY-API-KEY": GROCY_API_KEY,
                                         }});
            const json = await response.json();
            if (json.length > 0) {
                console.log("product already saved");
                buttons.style= 'padding:10px; background-color:green; color: white';
            } else {
                saveList.disabled = true;
                saveItem.disabled = false;
                saveItemGeneric.disabled = false;
                saveItemName.disabled = false;
                saveItemName.value=q(".product-title").innerText;
            }
        } else {
            console.log("Not enabled as not on the correct page");
            saveList.disabled = true;
            saveItem.disabled = true;
            saveItemGeneric.disabled = true;
            saveItemName.disabled = true;
            saveItemName.value="";
            buttons.style= 'padding:10px; background-color:grey; color: white';
            return;
        }
    }


    async function corstestf() {
        // download new image
        let base = "https://api.cors.lol/?url=";
        let test = "https://assets.woolworths.com.au/images/2010/54136.jpg?impolicy=wowcdxwbjbx&w=900&h=900"
        const response4 = await fetch(base + test,
                                      {headers: {
                                          "Accept": "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
                                      }});
        const status = await response4.status;
        console.log(status);
    }

    // Helper to fetch order and parse it
    async function fetchOrder() {
        const uri = window.location.toString();
        const id = uri.substring(uri.lastIndexOf('/') + 1);
        let urlBase = "";
        if (id && window.location.href.indexOf("https://www.woolworths.co.nz/lists/pastorders/") > -1) {
            urlBase = "https://www.woolworths.co.nz/api/v1/shoppers/my/past-orders/";
        } else if (id && window.location.href.indexOf("https://www.woolworths.co.nz/lists/saved/") > -1) {
            urlBase = "https://www.woolworths.co.nz/api/v1/shoppers/my/saved-lists/";
        } else {
            console.log("Not continuing list extractor as not on the correct page");
            return;
        }
        const response = await fetch(urlBase + id + "/items",
            {headers: {
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "X-Requested-With": "OnlineShopping.WebApp",
            }});
        const json = await response.json();
        return parseProducts(json);
    }

    async function fetchItem(event) {
        let params = new URLSearchParams(document.location.search);
        let id = params.get("stockcode");
        let urlBase = "";
        if (id && window.location.href.indexOf("https://www.woolworths.co.nz/shop/productdetails") > -1) {
            urlBase = "https://www.woolworths.co.nz/api/v1/products/";
        } else {
            console.log("Not continuing item extractor as not on the correct page");
            return;
        }
        const response = await fetch(urlBase + id,
            {headers: {
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "X-Requested-With": "OnlineShopping.WebApp",
            }});
        const json = await response.json();

        if (event.target.id="extract_buttons_item_generic") {
            let name = q("#extract_buttons_item_name");
            console.log(name.value.trim());
            if (name && name.value.trim().length > 0) {
                parseProductDetails(json, name.value.trim());
            } else {
                alert("name empty, not saving");
                return;
            }
        } else {
            parseProductDetails(json);
        }
    }

    function parseProductDetails(e, name) {
        let fields = {};
        // barcode is a hack from the image name as it's not included in the json

        fields.barcode = e.smallImageUrl.substring(0, e.smallImageUrl.indexOf('.'));
        fields.sku = e.sku;
        // fields.subsAllowed = e.subsAllowed; // seems to default to always false in past orders?
        fields.imageLink = e.images[0].big;

        // grocy product object
        fields.grocyobj = {};
        if (name) {
            fields.grocyobj.name = name;
        } else {
            fields.grocyobj.name = toTitleCase(e.name);
        }

        // map product type to grocy id (e.g. fruit and veg == 1)
        var grp = PROD_GRP_MAP.Other;
        if (PROD_GRP_MAP[e.breadcrumb.department.name]) {
            grp = PROD_GRP_MAP[e.breadcrumb.department.name];
        } else {
            console.warn("Unknown product type: " + e.breadcrumb.department.name);
        }
        fields.grocyobj.product_group_id = grp;

        // map product location to grocy id (best guess based on product type)
        var lcn = PROD_LCN_MAP.Other;
        if (PROD_LCN_MAP[e.breadcrumb.department.name]) {
            lcn = PROD_LCN_MAP[e.breadcrumb.department.name];
        } // no warning, it's already covered above in product type
        fields.grocyobj.location_id = lcn;

        // map product unit to grocy id (e.g. )
        var unit = UNIT_MAP.Item;
        if (e.unit && UNIT_MAP[e.unit]) {
            unit = UNIT_MAP[e.unit];
        } else {
            console.warn("Unknown unit: " + e.unit);
        }
        fields.grocyobj.qu_id_consume = unit;
        fields.grocyobj.qu_id_price = unit;
        fields.grocyobj.qu_id_purchase = unit;
        fields.grocyobj.qu_id_stock = unit;

        // add default grocy fields
        fields.grocyobj.treat_opened_as_out_of_stock = "1";
        fields.grocyobj.min_stock_amount = "1";
        fields.grocyobj.default_best_before_days = "-1"

        if (fields.barcode) {
            checkIfExistsOrAdd(fields);
        } else {
            console.error("product with no barcode: " + e.name);
            alert("product with no barcode: " + e.name);
        }
    }

    // Helper to parse data
    function parseProducts(data) {
        //console.log(data.products);
        data.products.items.forEach(e => {
            let fields = {};
            fields.barcode = e.barcode;
            fields.sku = e.sku;
            // fields.subsAllowed = e.subsAllowed; // seems to default to always false in past orders?
            fields.imageLink = e.images.big;

            // grocy product object
            fields.grocyobj = {};
            fields.grocyobj.name = toTitleCase(e.name);

            // map product type to grocy id (e.g. fruit and veg == 1)
            var grp = PROD_GRP_MAP.Other;
            if (e.departments && PROD_GRP_MAP[e.departments[0].name]) {
                grp = PROD_GRP_MAP[e.departments[0].name];
            } else {
                console.warn("Unknown product type: " + e.departments[0].name);
            }
            fields.grocyobj.product_group_id = grp;

            // map product location to grocy id (best guess based on product type)
            var lcn = PROD_LCN_MAP.Other;
            if (e.departments && PROD_LCN_MAP[e.departments[0].name]) {
                lcn = PROD_LCN_MAP[e.departments[0].name];
            } // no warning, it's already covered above in product type
            fields.grocyobj.location_id = lcn;

            // map product unit to grocy id (e.g. )
            var unit = UNIT_MAP.Item;
            if (e.unit && UNIT_MAP[e.unit]) {
                unit = UNIT_MAP[e.unit];
            } else {
                console.warn("Unknown unit: " + e.unit);
            }
            fields.grocyobj.qu_id_consume = unit;
            fields.grocyobj.qu_id_price = unit;
            fields.grocyobj.qu_id_purchase = unit;
            fields.grocyobj.qu_id_stock = unit;

            // add default grocy fields
            fields.grocyobj.treat_opened_as_out_of_stock = "1";
            fields.grocyobj.min_stock_amount = "1";
            fields.grocyobj.default_best_before_days = "-1"

            if (fields.barcode) {
                checkIfExistsOrAdd(fields);
            } else {
                console.error("product with no barcode: " + e.name);
                alert("product with no barcode: " + e.name);
            }
        });

    }

    async function checkIfExistsOrAdd(item) {
        const response = await fetch(GROCY_HOST + "/api/stock/products/by-barcode/" + item.barcode,
            {headers: {
                "Accept": "application/json",
                "GROCY-API-KEY": GROCY_API_KEY,
            }});
        const status = await response.status;
        if (status === 400) { // not already stored
            pushToGrocy(item);
        } else {
            console.debug("item name: " + item.name + ", barcode: " + item.barcode + " already exists");
        }
    }

    async function pushToGrocy(item) {
        // hack while testing
//         if (item.sku != 35742) {
//             return;
//         }

        // create product, and record id
        const response = await fetch(GROCY_HOST + "/api/objects/products",
            {headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "GROCY-API-KEY": GROCY_API_KEY,
            },
             method: "POST",
             body: JSON.stringify(item.grocyobj),
            });

        const json = await response.json();

        if (response.status !== 200) {
            console.error("Failed to store product: " + JSON.stringify(item));
            return;
        }

        let oid = json.created_object_id;

        // add barcode
        const bresponse = await fetch(GROCY_HOST + "/api/objects/product_barcodes",
            {headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "GROCY-API-KEY": GROCY_API_KEY,
            },
             method: "POST",
             body: JSON.stringify({barcode:item.barcode, product_id: oid}),
            });

        if (bresponse.status !== 200) {
            console.error("Failed to store barcode");
            return;
        }

        // add sku
        const sresponse = await fetch(GROCY_HOST + "/api/userfields/products/" + oid,
            {headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "GROCY-API-KEY": GROCY_API_KEY,
            },
             method: "PUT",
             body: JSON.stringify({sku: item.sku}),
            });

        if (sresponse.status !== 204) {
            console.error("Failed to store sku");
            return;
        }

        // add image

        let filename = item.barcode + ".jpg";

        // create name based on barcode
        let encodedfilename = btoa(filename);

        // check if image already exists
        const response3 = await fetch(GROCY_HOST + "/api/files/productpictures/" + encodedfilename,
            {headers: {
                "Accept": "application/json",
                "GROCY-API-KEY": GROCY_API_KEY,
            }});
        const status = await response3.status;
        if (status === 200) { // already stored
            console.log("image: " + encodedfilename + ", already stored");
           return;
        }

        // download new image
        const response4 = await fetch("https://api.cors.lol/?url=" + item.imageLink,
            {headers: {
                "Accept": "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
            }});

        const blob = await response4.blob();

        const response2 = await fetch(GROCY_HOST + "/api/files/productpictures/" + encodedfilename,
            {headers: {
                //"Content-Type": "application/octet-stream",
                "GROCY-API-KEY": GROCY_API_KEY,
            },
             method: "PUT",
             body: new File([blob], encodedfilename),
            });

        if (response2.status !== 204) {
            console.error("Failed to store image");
            return;
        }

        // attach image to product
        const response5 = await fetch(GROCY_HOST + "/api/objects/products/" + oid,
            {headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "GROCY-API-KEY": GROCY_API_KEY,
            },
             method: "PUT",
             body: JSON.stringify({picture_file_name: filename}),
            });

        const st = await response5.status;

        if (st !== 204) {
            console.error("Failed to update image");
        }

    }

    function toTitleCase(str) {
        return str.replace(
            /\w\S*/g,
            text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
        );
    }

        // Initialize and detect URL changes
    function initialize() {
        main(); // Run the main function when the page first loads
    }

        // Detect URL change
    function detectUrlChange(callback) {
        let oldHref = window.location.href;

        // Intercept history methods (pushState and replaceState)
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function () {
            originalPushState.apply(this, arguments);
            callback(); // Call when pushState is triggered
        };

        history.replaceState = function () {
            originalReplaceState.apply(this, arguments);
            callback(); // Call when replaceState is triggered
        };

        // Listen for popstate (back/forward buttons)
        window.addEventListener('popstate', callback);

        // Poll for URL changes (just in case)
        setInterval(() => {
            if (window.location.href !== oldHref) {
                oldHref = window.location.href;
                callback();
            }
        }, 500);
    }

    //window.addEventListener("load", main);

    // Detect URL change and re-initialize when it happens
    detectUrlChange(() => {
        console.log('URL changed, re-initializing...');
        initialize();
    });

    // Run the initial script
    initialize();

})();
