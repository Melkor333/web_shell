#!/usr/bin/env bash
# execute with bash -i or source. $() might work aswell

if [[ -z "$@" ]]; then
    exit 1
fi
#set -xo pipefail

run_func () {
    export COMP_CWORD="$MY_COMP_CWORD"
    export COMP_LINE="$MY_COMP_LINE"
    export COMP_TYPE="$MY_COMP_TYPE"
    export COMP_POINT="$MY_COMP_POINT"
    export MY_COMP_WORDS=($COMP_LINE)
    export COMP_CWORD=$((${#COMP_WORDS[@]}-1))
    #echo $@ >&2
    "$MY_FUNCNAME" "$COMP_LINE" "$COMP_CWORD" "$prog"
    type "$MY_FUNCNAME"
}


export MY_COMP_LINE="$@"
prog="${COMP_LINE%% *}"
# split completion line by space/newline
export MY_COMP_WORDS=($MY_COMP_LINE)

# we want "doubletap" expansion
export MY_COMP_TYPE=?

# We're always at the end of the line
export MY_COMP_POINT=${#COMP_LINE}
export MY_COMP_CWORD=$((${#COMP_WORDS[@]}-1))

if [[ "${#MY_COMP_LINE}" -gt "${#prog}" ]]; then
        # argument parsing
        comp_command="$(complete -p "$prog")"
        #comp_command="${comp_command/complete/compgen}" # TODO can't complete "complete" :)
        if [[ -z "$comp_command" ]]; then
            compgen_out=""
            echo no reply
        else
            is_func=false
            new_command=""
            # if we have 'compgen ... -F just run the function'
            # TODO Give the output back to compgen as completion list to expand on the other options
            echo $comp_command
            
            for arg in $comp_command; do
              if $is_func; then
              export MY_FUNCNAME="$arg"
              new_command="$new_command run_func"
              is_func=false
              #  ${comp_command% *} "${1}"
              #  echo ${COMPREPLY[@]}
              #  exit
              #  $arg "$COMP_LINE" "$COMP_CWORD" "$prog"
              #  echo ${COMPREPLY[@]}
              #  exit
              else
              case "$arg" in
                "-F")
                  # next argument is a function we wanna execute
                  is_func=true
                ;;
              esac
              fi
              new_command="$new_command $arg"
              #echo $arg
            done
            # echo "${comp_command% *} \"${1}\""
            new_command="${new_command/complete/compgen}"
            echo $new_command
            ${new_command% *} "${1}"
        fi

        # compgen -o bashdefault -o default -o nospace -F __git_wrap__git_main git s
        echo ${COMPREPLY[@]}
    else
        # complete first word
        compgen -abc $prog | sort -u
    fi