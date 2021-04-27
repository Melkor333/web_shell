// We need to insert hooks into bash to report state changes that happen
// during the execution of a command.
//
// This includes:
// - making bash think it's running in a terminal, by overloading tcgetprgp
// - attempts to set the foreground process group (before executing a pipeline)
// - cwd updates?

#include <unistd.h>
#include <stdio.h>

// The functions here are called after redirections are applied.
// TODO: Hardcoding fd 24 is fragile. Either copy fd 1 in the script instead
//       or look for the right fd in the bash undo stack.
// Fish does the sane thing and doesn't move its own file descriptors around.
// Script stdout is still fd 1 and command's out,err,in are fds 6,7,8
#define STDOUT_FD 24

// TODO: Print stuff in debug builds

// Need to unset LD_PRELOAD in the command server script instead of doing it here.
//
// The problem is bash redefines `unsetenv` to call its internal
// `unbind_variable`, so calling it in an __attribute__((constructor)) before
// bash has created internal variables does nothing.
//
// If we wanted to clear LD_PRELOAD here, we'd have to change environ directly.
// More info at: https://stackoverflow.com/questions/3275015/ld-preload-affects-new-child-even-after-unsetenvld-preload

// TODO: Ideally, this would always return bash's pgid
pid_t tcgetpgrp(int fd) {
    return getpgid(0);
}

int tcsetpgrp(int fd, pid_t pgrp) {
    dprintf(STDOUT_FD, "{\"Pgid\": %d}\n", pgrp);
    return 0;
}