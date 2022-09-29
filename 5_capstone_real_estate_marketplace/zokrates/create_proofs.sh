#!/bin/bash

zokrates compile -i square.zok

zokrates setup

for i in "1 2" "2 4" "3 9" "4 16" "5 25" "6 36" "7 49" "8 64" "9 81" "10 100"
do
    set -- $i
    
    echo $1 $2
    zokrates compute-witness -a $1 $2

    zokrates generate-proof -j proof$1.json
done

zokrates export-verifier