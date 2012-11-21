# fauxfm

a fake api for testing with leveldb caching.  the first time a call for userloves is made, fauxfm will grab that user's loves from the exfm api and cache them in a leveldb store.  subsequent calls for this user's loves will be pulled from the leveldb store.


## Install


     npm install fauxfm

## Running

    git clone
    npm install
    node fauxfm
